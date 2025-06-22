// TimeCamp API client class
export class TimeCampAPI {
	private baseUrl = "https://app.timecamp.com/third_party/api";
	private bearerToken: string;

	constructor(bearerToken: string) {
		this.bearerToken = bearerToken;
		
		// Validate bearer token
		if (!this.bearerToken) {
			throw new Error("No bearer token provided. Please set the TIMECAMP_TOKEN environment variable or provide Authorization header.");
		}
	}

	private getHeaders() {
		return {
			"Accept": "application/json",
			"Authorization": `Bearer ${this.bearerToken}`,
			"Content-Type": "application/json",
		};
	}

	private calculateDuration(startTime: string, endTime: string): number {
		const start = new Date(startTime);
		const end = new Date(endTime);
		return Math.floor((end.getTime() - start.getTime()) / 1000); // Duration in seconds
	}

	private formatDateForAPI(dateTime: string): string {
		// Convert "2025-06-22 13:28" format to "2025-06-22 13:28:00"
		if (dateTime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
			return dateTime + ":00";
		}
		return dateTime;
	}

	async createTimeEntry(from: string, to: string, note: string, task_id?: string) {
		try {
			// Format and validate dates
			const startTime = this.formatDateForAPI(from);
			const endTime = this.formatDateForAPI(to);
			const duration = this.calculateDuration(startTime, endTime);

			if (duration <= 0) {
				throw new Error("End time must be after start time");
			}

			// Extract date for the API (YYYY-MM-DD format)
			const date = from.split(' ')[0];

			// Prepare request body
			const requestBody: any = {
				get_entries: 0,
				date: date,
				start_time: startTime,
				end_time: endTime,
				duration: duration,
				note: note,
				service: 'timecamp-mcp',
			};

			// Add task_id if provided
			if (task_id) {
				requestBody.task_id = task_id;
			}

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries`, {
				method: "POST",
				headers: this.getHeaders(),
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			return {
				success: true,
				duration: Math.floor(duration / 60), // duration in minutes
				data: result,
				message: `Successfully created time entry from ${from} to ${to} (${Math.floor(duration / 60)} minutes).`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async getTimeEntries(fromDate: string, toDate: string, userIds = "me", optFields = "tags") {
		try {
			// Prepare query parameters
			const params = new URLSearchParams({
				from: fromDate,
				to: toDate,
				user_ids: userIds,
				opt_fields: optFields,
			});

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries?${params.toString()}`, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			
			// Process the response to remove unwanted fields and rename description to note
			const processedData = Array.isArray(result) ? result.map(entry => {
				const { task_note, locked, addons_external_id, color, description, hasEntryLocationHistory, name, duration, ...cleanEntry } = entry;
				
				// Calculate duration in hours
				const durationSeconds = parseInt(duration) || 0;
				const durationHours = (durationSeconds / 3600).toFixed(2);
				
				return {
					...cleanEntry,
					task_name: name || "",
					duration_seconds: durationSeconds,
					duration_hours: parseFloat(durationHours),
					note: description || ""
				};
			}) : result;

			return {
				success: true,
				data: processedData,
				message: `Time entries from ${fromDate} to ${toDate}`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async getTasks() {
		try {
			// Prepare query parameters
			const params = new URLSearchParams({
				ignoreAdminRights: "1"
			});

			// Make API request
			const response = await fetch(`${this.baseUrl}/tasks?${params.toString()}`, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

					const result = await response.json();
		
		// Convert object to array, filter non-archived tasks, and return only specified fields
		const tasksArray = Object.values(result as Record<string, any>)
			.filter((task: any) => task.archived == 0)
			.map((task: any) => ({
				task_id: task.task_id,
				parent_id: task.parent_id,
				name: task.name,
				level: task.level,
				note: task.note
			}));

		return {
			success: true,
			data: tasksArray,
			message: "Successfully fetched TimeCamp projects and tasks (non-archived only)"
		};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async getTimeEntryById(entryId: string, date?: string) {
		try {
			let fromDate: string;
			let toDate: string;

			if (date) {
				// Use provided date
				fromDate = date;
				toDate = date;
			} else {
				// Use last 30 days
				const today = new Date();
				const thirtyDaysAgo = new Date(today);
				thirtyDaysAgo.setDate(today.getDate() - 30);
				
				fromDate = thirtyDaysAgo.toISOString().split('T')[0];
				toDate = today.toISOString().split('T')[0];
			}

			// Fetch time entries for the specified date range
			const entriesResult = await this.getTimeEntries(fromDate, toDate, "me", "tags");
			if (!entriesResult.success) {
				throw new Error(`Could not fetch time entries: ${entriesResult.error}`);
			}

			// Find the specific entry by ID
			const targetEntry = (entriesResult.data as any[]).find(entry => entry.id === parseInt(entryId));
			if (!targetEntry) {
				throw new Error(`Time entry with ID ${entryId} not found in the specified date range`);
			}

			return {
				success: true,
				data: targetEntry,
				message: `Successfully found time entry with ID ${entryId}`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async deleteTimeEntry(entryId: string) {
		try {
			// Prepare request body as URL-encoded form data
			const requestBody = `id=${entryId}&service=timecamp-mcp`;

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries`, {
				method: "DELETE",
				headers: {
					"Accept": "application/json",
					"Authorization": `Bearer ${this.bearerToken}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: requestBody,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();

			return {
				success: true,
				data: result,
				message: `Successfully deleted time entry with ID: ${entryId}`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async updateTimeEntry(entryId: string, from?: string, to?: string, note?: string, task_id?: string) {
		try {
			// Prepare request body with required fields
			const requestBody: any = {
				id: parseInt(entryId),
				service: 'timecamp-mcp',
			};

			let duration = 0;
			let timeUpdated = false;
			let finalStartTime = from;
			let finalEndTime = to;

			// Handle time updates
			if (from || to) {
				// Validate time format (HH:MM) for provided times
				const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
				if (from && !timeRegex.test(from)) {
					throw new Error("Start time format must be HH:MM (e.g., 15:28)");
				}
				if (to && !timeRegex.test(to)) {
					throw new Error("End time format must be HH:MM (e.g., 15:28)");
				}

				// If only one time is provided, fetch existing entry to get the other time
				if ((from && !to) || (!from && to)) {
					// Fetch the existing entry details (searches last 30 days if not found today)
					const entryResult = await this.getTimeEntryById(entryId);
					if (!entryResult.success) {
						throw new Error(`Could not fetch existing time entry: ${entryResult.error}`);
					}

					const existingEntry = entryResult.data;

					// Extract existing times (format: "HH:MM:SS")
					const existingStartTime = existingEntry.start_time?.substring(0, 5); // Get HH:MM part
					const existingEndTime = existingEntry.end_time?.substring(0, 5); // Get HH:MM part

					// Use existing times for missing values
					if (!from && to) {
						finalStartTime = existingStartTime;
						finalEndTime = to;
					} else if (from && !to) {
						finalStartTime = from;
						finalEndTime = existingEndTime;
					}

					if (!finalStartTime || !finalEndTime) {
						throw new Error("Could not determine existing start or end time from the current entry");
					}
				}

				// Now we should have both start and end times
				if (finalStartTime && finalEndTime) {
					// Add seconds if not present (API expects HH:MM:SS)
					const startTimeFormatted = finalStartTime.includes(':') && finalStartTime.split(':').length === 2 ? finalStartTime + ':00' : finalStartTime;
					const endTimeFormatted = finalEndTime.includes(':') && finalEndTime.split(':').length === 2 ? finalEndTime + ':00' : finalEndTime;

					// Calculate duration (assuming same day)
					const startMinutes = parseInt(finalStartTime.split(':')[0]) * 60 + parseInt(finalStartTime.split(':')[1]);
					const endMinutes = parseInt(finalEndTime.split(':')[0]) * 60 + parseInt(finalEndTime.split(':')[1]);
					duration = (endMinutes - startMinutes) * 60; // Convert to seconds

					if (duration <= 0) {
						throw new Error("End time must be after start time");
					}

					requestBody.start_time = startTimeFormatted;
					requestBody.end_time = endTimeFormatted;
					requestBody.duration = duration;
					timeUpdated = true;
				}
			}

			if (note !== undefined) {
				requestBody.note = note;
			}

			if (task_id) {
				requestBody.task_id = parseInt(task_id);
			}

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries`, {
				method: "PUT",
				headers: this.getHeaders(),
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			
			// Create appropriate success message
			let message = `Successfully updated time entry ID ${entryId}`;
			if (timeUpdated) {
				message += ` with time from ${finalStartTime} to ${finalEndTime} (${Math.floor(duration / 60)} minutes)`;
			}
			message += '.';

			return {
				success: true,
				duration: timeUpdated ? Math.floor(duration / 60) : undefined, // duration in minutes if updated
				data: result,
				message: message
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
} 