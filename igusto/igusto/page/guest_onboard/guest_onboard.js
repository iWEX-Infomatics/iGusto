// igusto/igusto/page/guest_onboard/guest_onboard.js

frappe.pages['guest-onboard'].on_page_load = function (wrapper) {
	new GuestOnboarding(wrapper);
};

class GuestOnboarding {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true
		});
		this.roommates = [];
		this.videoStream = null;
		this.capturedPhotoBlob = null;
		this.currentSalesOrder = null;
		this.make();
		this.load_company_details();
	}
  
	load_company_details() {
		frappe.call({
			method: "igusto.igusto.page.room_order.room_order.get_company_details",
			callback: (r) => {
				const data = r.message;
				if (!data) return;

				const logo_html = data.logo
					? `<img src="${data.logo}" class="company-logo">`
					: `<div class="company-logo-placeholder">No Logo</div>`;

				const address_line = "Munnar";
				const contact_line = ` ${data.phone_no || ""} | ${data.email || ""}`;

				const header_html = `
					<div class="company-header-inner">
						<div class="company-left">${logo_html}</div>
						<div class="company-right">
							<h2 class="company-name">${data.company_name}</h2>
							<div class="company-details">
								<div>${address_line} | ${contact_line}</div>
							</div>
						</div>
					</div>
				`;

				$(".company-header").html(header_html);
			}
		});
	}

	make() {
		let me = this;

		let html = frappe.render_template("guest_onboard", {});
		$(html).appendTo(this.page.body);

		setTimeout(() => me.load_company_details(), 300);
		setTimeout(() => me.create_link_fields(), 200);
		setTimeout(() => me.prefill_guest_and_fields(), 300);

		this.page.body.find("#btn_submit_onboard").on("click", () => me.submit_onboarding());
		this.page.body.find("#btn_fetch_booking").on("click", () => me.fetch_booking_from_guest());

		this.setup_passport_visa_visibility();
		this.setup_camera();
		this.setup_roommates();
		this.setup_date_restrictions();
		
		$(this.page.body).on("change", "#no_of_guests", () => me.toggle_roommates_section());

		$(this.page.body).on("blur keyup", "#guest", function (e) {
			if (e.type === "blur" || e.keyCode === 13) {
				const guestVal = $(this).val();
				if (guestVal && guestVal.trim()) {
					me.fetch_booking_from_guest();
				}
			}
		});
	}

	create_link_fields() {
		let me = this;
		
		// Nationality Field
		setTimeout(() => {
			me.nationality_field = frappe.ui.form.make_control({
				df: {
					fieldtype: "Link",
					fieldname: "nationality",
					options: "Country",
					placeholder: "Nationality"
				},
				parent: $("#nationality"),
				render_input: true
			});
			if (me.nationality_field) {
				me.nationality_field.refresh();
				me.nationality_field_ready = true;
				
				if (me.pending_nationality) {
					me.set_nationality_value(me.pending_nationality);
					me.pending_nationality = null;
				}
			}
		}, 100);

		// ID Proof Type Field - Using Select dropdown
		setTimeout(() => {
			me.load_id_proof_options();
		}, 100);
	}

	load_id_proof_options() {
		let me = this;
		
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "ID Proof",
				fields: ["name"],
				order_by: "name asc"
			},
			callback: function(r) {
				if (r.message && r.message.length > 0) {
					let options = '<option value="">Select ID Proof Type</option>';
					r.message.forEach(proof => {
						options += `<option value="${proof.name}">${proof.name}</option>`;
					});
					
					const select = $('<select class="form-control-col" id="id_proof_type_select"></select>');
					select.html(options);
					
					$("#id_proof_type").html('').append(select);
					
					select.on("change", function() {
						me.update_passport_visa_visibility();
					});
				}
			}
		});
	}

	set_nationality_value(nationality) {
		let me = this;
		
		if (!nationality) return;
		
		let normalizedNat = nationality;
		if (normalizedNat.toLowerCase() === 'indian' || normalizedNat.toLowerCase() === 'india') {
			normalizedNat = 'India';
		}
		
		if (!me.nationality_field_ready || !me.nationality_field) {
			me.pending_nationality = normalizedNat;
			return;
		}
		
		const setValueWithRetry = (attempt = 0) => {
			if (attempt > 5) {
				console.warn("Failed to set nationality after 5 attempts");
				return;
			}
			
			if (me.nationality_field && me.nationality_field.set_value) {
				try {
					me.nationality_field.set_value(normalizedNat);
					setTimeout(() => {
						if (me.nationality_field.$input) {
							me.nationality_field.$input.trigger("change");
						}
					}, 100);
				} catch (e) {
					console.error("Error setting nationality:", e);
					setTimeout(() => setValueWithRetry(attempt + 1), 200);
				}
			} else {
				setTimeout(() => setValueWithRetry(attempt + 1), 200);
			}
		};
		
		setValueWithRetry();
	}

	setup_passport_visa_visibility() {
		let me = this;
		me.update_passport_visa_visibility();
	}

	update_passport_visa_visibility() {
		const idProofType = $("#id_proof_type_select").val() || "";

		if (idProofType === "Passport") {
			$("#passport_number_group").show();
			$("#visa_number_group").show();
			$("#id_proof_number").closest(".form-group-col").hide();
		} else {
			$("#passport_number_group").hide();
			$("#visa_number_group").hide();
			$("#passport_number").val("");
			$("#visa_number").val("");
			$("#id_proof_number").closest(".form-group-col").show();
		}
	}

setup_camera() {
		let me = this;

		$(this.page.body).on("click", "#capture_photo", async function () {
			try {
				me.videoStream = await navigator.mediaDevices.getUserMedia({ 
					video: { facingMode: "user" } 
				});
				$("#video_stream")[0].srcObject = me.videoStream;
				$("#video_stream")[0].play();
				$("#camera_preview").show();
			} catch (err) {
				frappe.msgprint("Unable to access camera: " + err.message);
			}
		});

		$(this.page.body).on("click", "#take_photo", function () {
			const video = $("#video_stream")[0];
			const canvas = $("#photo_canvas")[0];
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			canvas.getContext("2d").drawImage(video, 0, 0);

			canvas.toBlob(function (blob) {
				me.capturedPhotoBlob = blob;
				
				// Create a File object from the blob
				const file = new File([blob], "captured_photo.jpg", { type: "image/jpeg" });
				
				// Create a DataTransfer object to set the file input
				const dataTransfer = new DataTransfer();
				dataTransfer.items.add(file);
				
				// Set the file to the file input
				const fileInput = $("#guest_photo")[0];
				fileInput.files = dataTransfer.files;
				
				// Trigger change event to show file name
				$(fileInput).trigger("change");
				
				// Hide camera preview
				$("#camera_preview").hide();
				$("#captured_photo").hide();
				
				// Stop video stream
				if (me.videoStream) {
					me.videoStream.getTracks().forEach(track => track.stop());
				}
				
				// Show success message
				frappe.show_alert({
					message: "📸 Photo captured successfully",
					indicator: "green"
				}, 3);
			}, "image/jpeg");
		});

		$(this.page.body).on("click", "#cancel_camera", function () {
			$("#camera_preview").hide();
			if (me.videoStream) {
				me.videoStream.getTracks().forEach(track => track.stop());
			}
		});
	}
	setup_roommates() {
		let me = this;

		$(this.page.body).on("click", "#add_roommate", () => me.add_roommate_row());

		$(this.page.body).on("change", ".roommate-id-proof-type-select", function (e) {
			const index = $(this).data("index");
			const value = $(this).val();
			
			if (value && value.trim()) {
				setTimeout(() => {
					me.expand_roommate_row(index);
					me.toggle_roommate_passport_visa(index);
				}, 100);
			}
		});

		$(this.page.body).on("click", ".roommate-expand-btn", function () {
			const index = $(this).attr("data-index");
			me.toggle_roommate_expansion(index);
		});
	}

	expand_roommate_row(index) {
		const $row = $(`.roommate-additional-row[data-index="${index}"]`);
		const $btn = $(`.roommate-expand-btn[data-index="${index}"]`);
		
		if (!$row.is(":visible")) {
			$row.show();
			$btn.text("▲");
		}
	}

	toggle_roommate_expansion(index) {
		const $row = $(`.roommate-additional-row[data-index="${index}"]`);
		const $btn = $(`.roommate-expand-btn[data-index="${index}"]`);
		
		$row.toggle();
		$btn.text($row.is(":visible") ? "▲" : "▼");
	}

	setup_date_restrictions() {
		let me = this;
		const today = new Date().toISOString().split('T')[0];
		
		$("#from_date, #to_date").attr("min", today);
		
		$("#from_date, #to_date").on("change", function() {
			const selectedDate = $(this).val();
			if (selectedDate < today) {
				frappe.msgprint({
					title: __("Invalid Date"),
					message: __("Past dates are not allowed. Please select today or a future date."),
					indicator: "red"
				});
				$(this).val("");
			}
		});
		
		$("#to_date").on("change", function() {
			const fromDate = $("#from_date").val();
			const toDate = $(this).val();
			if (fromDate && toDate && toDate < fromDate) {
				frappe.msgprint({
					title: __("Invalid Date Range"),
					message: __("To Date cannot be before From Date"),
					indicator: "red"
				});
				$(this).val("");
			}
		});
		
		$(this.page.body).on("focus", ".roommate-from-date, .roommate-to-date", function() {
			$(this).attr("min", today);
		});
		
		$(this.page.body).on("change", ".roommate-from-date, .roommate-to-date", function() {
			const selectedDate = $(this).val();
			const index = $(this).attr("data-index");
			
			if (selectedDate < today) {
				frappe.msgprint({
					title: __("Invalid Date"),
					message: __(`Past dates are not allowed for Roommate ${parseInt(index) + 1}`),
					indicator: "red"
				});
				$(this).val("");
				return;
			}
			
			if ($(this).hasClass("roommate-to-date")) {
				const fromDate = $(`.roommate-from-date[data-index="${index}"]`).val();
				if (fromDate && selectedDate < fromDate) {
					frappe.msgprint({
						title: __("Invalid Date Range"),
						message: __(`To Date cannot be before From Date for Roommate ${parseInt(index) + 1}`),
						indicator: "red"
					});
					$(this).val("");
				}
			}
		});

		$(this.page.body).on("focus", ".roommate-dob", function() {
			$(this).attr("max", today);
		});
		
		$(this.page.body).on("change", ".roommate-dob", function() {
			const selectedDate = $(this).val();
			const index = $(this).attr("data-index");
			
			if (selectedDate > today) {
				frappe.msgprint({
					title: __("Invalid Date of Birth"),
					message: __(`Date of Birth cannot be in the future for Roommate ${parseInt(index) + 1}`),
					indicator: "red"
				});
				$(this).val("");
			}
		});
	}

	async fetch_roommate_guest_details(index, guestName) {
		let me = this;
		
		try {
			const existsRes = await frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Guest",
					filters: { name: guestName },
					fieldname: ["name", "nationality"]
				}
			});

			if (existsRes && existsRes.message && existsRes.message.name) {
				const guest = existsRes.message;
				
				if (guest.nationality && me.roommates[index] && me.roommates[index].nationality_field) {
					let normalizedNat = guest.nationality;
					if (normalizedNat.toLowerCase() === 'indian' || normalizedNat.toLowerCase() === 'india') {
						normalizedNat = 'India';
					}
					
					setTimeout(() => {
						if (me.roommates[index] && me.roommates[index].nationality_field && me.roommates[index].nationality_field.set_value) {
							me.roommates[index].nationality_field.set_value(normalizedNat);
							if (me.roommates[index].nationality_field.$input) {
								me.roommates[index].nationality_field.$input.trigger("change");
							}
						}
					}, 200);
				}

				frappe.show_alert({
					message: `✓ Guest details loaded for ${guestName}`,
					indicator: 'green'
				}, 2);
			}
		} catch (e) {
			console.log(`Guest '${guestName}' not found in system`);
		}
	}

	toggle_roommate_passport_visa(index) {
		const idProofType = $(`.roommate-id-proof-type-select[data-index="${index}"]`).val() || "";
		
		if (idProofType === "Passport") {
			$(`.roommate-passport-group[data-index="${index}"]`).show();
			$(`.roommate-visa-group[data-index="${index}"]`).show();
			$(`.roommate-id-number-group[data-index="${index}"]`).hide();
		} else {
			$(`.roommate-passport-group[data-index="${index}"]`).hide();
			$(`.roommate-visa-group[data-index="${index}"]`).hide();
			$(`.roommate-passport[data-index="${index}"]`).val("");
			$(`.roommate-visa[data-index="${index}"]`).val("");
			$(`.roommate-id-number-group[data-index="${index}"]`).show();
		}
	}

	toggle_roommates_section() {
		const noOfGuests = parseInt($("#no_of_guests").val()) || 0;
		if (noOfGuests > 1) {
			$("#roommates_section").show();
			if (this.roommates.length === 0) {
				for (let i = 0; i < noOfGuests - 1; i++) {
					this.add_roommate_row();
				}
			}
		} else {
			$("#roommates_section").hide();
			this.roommates = [];
			$("#roommates_container").empty();
		}
	}

	add_roommate_row() {
		let me = this;
		const index = this.roommates.length;
		const today = new Date().toISOString().split('T')[0];
		
		// Get main form dates to prefill roommate dates
		const mainFromDate = $("#from_date").val();
		const mainToDate = $("#to_date").val();
		
		const mainRow = `
			<tr class="roommate-main-row" data-index="${index}">
				<td style="text-align: center;">${index + 1}</td>
				<td>
					<input type="text" class="roommate-guest-name" data-index="${index}" placeholder="Guest name">
				</td>
				<td>
					<input type="date" class="roommate-dob" data-index="${index}" max="${today}" placeholder="Date of Birth">
				</td>
				<td data-index="${index}">
					<select class="roommate-id-proof-type-select form-control-col" data-index="${index}">
						<option value="">Select</option>
					</select>
				</td>
				<td style="text-align: center;">
					<button type="button" class="roommate-expand-btn" data-index="${index}" 
						style="background: #2563eb; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; margin-right: 4px;">▼</button>
					<button type="button" class="roommate-delete-btn" data-index="${index}" 
						style="background: #dc2626; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">✕</button>
				</td>
			</tr>
		`;
		
		const additionalRow = `
			<tr class="roommate-additional-row" data-index="${index}" style="display: none;">
				<td colspan="5" style="background: #f9fafb; padding: 20px;">
					<div class="additional-fields-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
						<div class="additional-field-group">
							<label>Start Date</label>
							<input type="date" class="roommate-from-date" data-index="${index}" min="${today}" value="${mainFromDate || ''}" readonly>
						</div>
						<div class="additional-field-group">
							<label>End Date</label>
							<input type="date" class="roommate-to-date" data-index="${index}" min="${today}" value="${mainToDate || ''}" readonly>
						</div>
						<div class="additional-field-group">
							<label>Nationality</label>
							<div id="roommate_nationality_${index}" style="width: 100%; margin-top: -20px;"></div>
						</div>
						<div class="additional-field-group roommate-id-number-group" data-index="${index}">
							<label>ID Proof Number</label>
							<input type="text" class="roommate-id-proof-number" data-index="${index}" placeholder="ID number">
						</div>
						<div class="additional-field-group roommate-passport-group" data-index="${index}" style="display: none;">
							<label>Passport Number</label>
							<input type="text" class="roommate-passport" data-index="${index}">
						</div>
						<div class="additional-field-group roommate-visa-group" data-index="${index}" style="display: none;">
							<label>Visa Number</label>
							<input type="text" class="roommate-visa" data-index="${index}">
						</div>
						<div class="additional-field-group">
							<label>Room Type</label>
							<select class="roommate-room-type" data-index="${index}">
								<option value="">Select</option>
							</select>
						</div>
						<div class="additional-field-group">
							<label>Room Number</label>
							<select class="roommate-room-number" data-index="${index}">
								<option value="">Select</option>
							</select>
						</div>
						<div class="additional-field-group">
							<label>Card/Key No</label>
							<input type="text" class="roommate-rfid" data-index="${index}">
						</div>
						<div class="additional-field-group">
							<label>Check-in Time</label>
							<input type="time" class="roommate-checkin" data-index="${index}" value="14:00">
						</div>
						<div class="additional-field-group">
							<label>Check-out Time</label>
							<input type="time" class="roommate-checkout" data-index="${index}" value="11:00">
						</div>
						<div class="additional-field-group">
							<label>Photo</label>
							<input type="file" class="roommate-photo" data-index="${index}" accept="image/*">
						</div>
					</div>
				</td>
			</tr>
		`;
		
		$("#roommates_container").append(mainRow + additionalRow);
		
		// Load ID Proof options
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "ID Proof",
				fields: ["name"],
				order_by: "name asc"
			},
			callback: function(r) {
				if (r.message && r.message.length > 0) {
					let options = '<option value="">Select</option>';
					r.message.forEach(proof => {
						options += `<option value="${proof.name}">${proof.name}</option>`;
					});
					$(`.roommate-id-proof-type-select[data-index="${index}"]`).html(options);
				}
			}
		});
		
		// Create Nationality field
		const nationality_field = frappe.ui.form.make_control({
			df: {
				fieldtype: "Link",
				fieldname: `roommate_nationality_${index}`,
				options: "Country",
				placeholder: "Select"
			},
			parent: $(`#roommate_nationality_${index}`),
			render_input: true
		});
		
		if (nationality_field) nationality_field.refresh();
		
		this.roommates.push({ nationality_field: nationality_field });

		this.load_room_data_for_roommate(index);

		$(`.roommate-delete-btn[data-index="${index}"]`).on("click", () => {
			$(`.roommate-main-row[data-index="${index}"]`).remove();
			$(`.roommate-additional-row[data-index="${index}"]`).remove();
			this.roommates.splice(index, 1);
			this.renumber_roommates();
		});

		$(`.roommate-guest-name[data-index="${index}"]`).on("blur", function() {
			const guestName = $(this).val();
			if (guestName && guestName.trim()) {
				me.fetch_roommate_guest_details(index, guestName.trim());
			}
		});

		this.toggle_roommate_passport_visa(index);
	}

	load_room_data_for_roommate(index) {
		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room Type", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Select</option>`;
					r.message.forEach(rt => {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$(`.roommate-room-type[data-index="${index}"]`).html(options);
				}
			}
		});

		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Select</option>`;
					r.message.forEach(room => {
						options += `<option value="${room.name}">${room.name}</option>`;
					});
					$(`.roommate-room-number[data-index="${index}"]`).html(options);
				}
			}
		});
	}

	renumber_roommates() {
		$("#roommates_container .roommate-main-row").each((i, row) => {
			$(row).attr("data-index", i);
			$(row).find("td:first").text(i + 1);
			$(row).find("input, select, button, div[id^='roommate']").each(function () {
				const currentId = $(this).attr("id");
				if (currentId && currentId.includes("roommate")) {
					const newId = currentId.replace(/_\d+$/, `_${i}`);
					$(this).attr("id", newId);
				}
				$(this).attr("data-index", i);
			});
			$(row).next(".roommate-additional-row").attr("data-index", i);
			$(row).next(".roommate-additional-row").find("input, select").each(function () {
				$(this).attr("data-index", i);
			});
		});
	}

	async fetch_booking_from_guest() {
		let me = this;
		const guestName = $("#guest").val();
		
		if (!guestName || !guestName.trim()) return;

		let guestId = guestName;
		if (guestName.includes(" : ")) {
			guestId = guestName.split(" : ")[0].trim();
		}

		try {
			const res = await frappe.call({
				method: "igusto.igusto.page.guest_onboard.guest_onboard.get_guest_booking_details",
				args: { full_name: guestId }
			});

			if (res.message && res.message.error) {
				frappe.show_alert({
					message: `${res.message.error} (Guest ID: ${res.message.guest_id || 'N/A'})`,
					indicator: 'orange'
				}, 5);
				return;
			}

			if (res.message && res.message.booking_name) {
				const booking = res.message;
				
				me.currentSalesOrder = booking.booking_name;
				
				if (booking.guest_display) $("#guest").val(booking.guest_display);
				if (booking.from_date) $("#from_date").val(booking.from_date);
				if (booking.to_date) $("#to_date").val(booking.to_date);
				if (booking.no_of_guests) {
					$("#no_of_guests").val(booking.no_of_guests);
					me.toggle_roommates_section();
				}
				if (booking.room_type) {
					setTimeout(() => {
						$("#room_type").val(booking.room_type);
					}, 500);
				}
				if (booking.nationality) {
					me.set_nationality_value(booking.nationality);
				}
			} else {
				frappe.show_alert({
					message: 'No booking found for this guest',
					indicator: 'orange'
				}, 3);
			}
		} catch (e) {
			frappe.show_alert({
				message: 'Error fetching booking details',
				indicator: 'red'
			}, 3);
		}
	}

	async prefill_guest_and_fields() {
		let me = this;
		let guestName = "";
		let bookingName = "";

		if (frappe.route_options && frappe.route_options.guest) {
			guestName = frappe.route_options.guest;
		}
		if (frappe.route_options && frappe.route_options.booking) {
			bookingName = frappe.route_options.booking;
		}

		if (!guestName) {
			const lastBooking = JSON.parse(localStorage.getItem("last_booking") || "{}");
			guestName = lastBooking.guest || "";
			bookingName = lastBooking.booking || "";
		}

		if (bookingName) {
			try {
				let res = await frappe.call({
					method: "frappe.client.get",
					args: {
						doctype: "Sales Order",
						name: bookingName
					}
				});
				if (res.message) {
					let booking = res.message;
					$("#from_date").val(booking.delivery_date || "");
					$("#to_date").val(booking.custom_to_date || "");
					$("#no_of_guests").val(booking.custom_no_of_guests || "");
					$("#room_type").val(booking.custom_room_type || "");
					
					if (!guestName && booking.custom_guest) {
						guestName = booking.custom_guest;
					}
					
					me.toggle_roommates_section();
				}
			} catch (e) {
				console.error("Failed to fetch booking:", e);
			}
		}

		if (!guestName) {
			try {
				let res = await frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Guest",
						fields: ["name"],
						order_by: "creation desc",
						limit: 1
					}
				});
				if (res.message && res.message.length > 0) {
					guestName = res.message[0].name;
				}
			} catch (e) {
				console.error("Failed to fetch latest guest:", e);
			}
		}

		$("#guest").val(guestName);

		if (guestName) {
			frappe.call({
				method: "frappe.client.get_value",
				args: { 
					doctype: "Guest", 
					filters: { name: guestName },
					fieldname: ["name", "nationality", "full_name"]
				},
				callback: function (r) {
					if (r.message && r.message.name) {
						let g = r.message;
						
						if (g.full_name) {
							$("#guest").val(`${g.name} : ${g.full_name}`);
						}
						
						if (g.nationality) {
							me.set_nationality_value(g.nationality);
						}
					}
				}
			});

			me.fetch_booking_from_guest();
		}

		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room Type", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Room Type</option>`;
					r.message.forEach(rt => {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$("#room_type").html(options);
					
					const savedRoomType = $("#room_type").data("preselect");
					if (savedRoomType) {
						$("#room_type").val(savedRoomType);
					}
				}
			}
		});

		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Select Room Number</option>`;
					r.message.forEach(room => {
						options += `<option value="${room.name}">${room.name}</option>`;
					});
					$("#room_number").html(options);
				}
			}
		});
	}

	collect_roommates_data() {
		let me = this;
		const roommates = [];
		$("#roommates_container .roommate-main-row").each(function (i) {
			const idProofType = $(`.roommate-id-proof-type-select[data-index="${i}"]`).val() || "";
			
			roommates.push({
				full_name: $(`.roommate-guest-name[data-index="${i}"]`).val(),
				date_of_birth: $(`.roommate-dob[data-index="${i}"]`).val(),
				from_date: $(`.roommate-from-date[data-index="${i}"]`).val(),
				to_date: $(`.roommate-to-date[data-index="${i}"]`).val(),
				nationality: (me.roommates[i] && me.roommates[i].nationality_field && me.roommates[i].nationality_field.get_value()) || "",
				id_proof_type: idProofType,
				passport_number: idProofType === "Passport" ? $(`.roommate-passport[data-index="${i}"]`).val() : "",
				visa_number: idProofType === "Passport" ? $(`.roommate-visa[data-index="${i}"]`).val() : "",
				id_proof_number: idProofType !== "Passport" ? $(`.roommate-id-proof-number[data-index="${i}"]`).val() : "",
				room_type: $(`.roommate-room-type[data-index="${i}"]`).val(),
				room_number: $(`.roommate-room-number[data-index="${i}"]`).val(),
				rfid_card_no: $(`.roommate-rfid[data-index="${i}"]`).val(),
				check_in_time: $(`.roommate-checkin[data-index="${i}"]`).val(),
				check_out_time: $(`.roommate-checkout[data-index="${i}"]`).val(),
				photo_file: $(`.roommate-photo[data-index="${i}"]`)[0].files[0]
			});
		});
		return roommates;
	}

	validate_roommates() {
		const noOfGuests = parseInt($("#no_of_guests").val()) || 0;
		if (noOfGuests > 1) {
			const roommates = this.collect_roommates_data();
			if (roommates.length === 0) {
				frappe.msgprint("Please add roommate details for additional guests");
				return false;
			}
			for (let i = 0; i < roommates.length; i++) {
				if (!roommates[i].full_name) {
					frappe.msgprint(`Please enter name for Roommate ${i + 1}`);
					return false;
				}
				if (!roommates[i].id_proof_type) {
					frappe.msgprint(`Please select ID Proof Type for Roommate ${i + 1}`);
					return false;
				}
			}
		}
		return true;
	}

	async submit_onboarding() {
		let me = this;
		if (!me.currentSalesOrder) {
			frappe.msgprint("Sales Order not linked. Please fetch booking first.");
			return;
		}


		if (!this.validate_roommates()) {
			return;
		}

		const idProofType = $("#id_proof_type_select").val() || "";

		let data = {
			guest: $("#guest").val(),
			from_date: $("#from_date").val(),
			to_date: $("#to_date").val(),
			no_of_guests: $("#no_of_guests").val(),
			nationality: (this.nationality_field && this.nationality_field.get_value()) || "",
			id_proof_type: idProofType,
			passport_number: idProofType === "Passport" ? $("#passport_number").val() : "",
			visa_number: idProofType === "Passport" ? $("#visa_number").val() : "",
			id_proof_number: idProofType !== "Passport" ? $("#id_proof_number").val() : "",
			room_type: $("#room_type").val(),
			room_number: $("#room_number").val(),
			rfid_card_no: $("#rfid_card_no").val(),
			check_in_time: $("#check_in_time").val(),
			check_out_time: $("#check_out_time").val(),
			sales_order: me.currentSalesOrder,
			roommates: []
		};

		let filesToUpload = [];

		let photoFile = $("#guest_photo")[0].files[0];
		if (photoFile) {
			filesToUpload.push({ file: photoFile, fieldname: "guest_photo" });
		} else if (me.capturedPhotoBlob) {
			filesToUpload.push({ 
				file: new File([me.capturedPhotoBlob], "captured_photo.jpg", { type: "image/jpeg" }), 
				fieldname: "guest_photo" 
			});
		}

		let idProofFile = $("#id_proof_file")[0].files[0];
		if (idProofFile) {
			filesToUpload.push({ file: idProofFile, fieldname: "id_proof_attachment" });
		}

		if (filesToUpload.length > 0) {
			try {
				for (let fileObj of filesToUpload) {
					let uploadedUrl = await me.upload_file(fileObj.file, $("#guest").val());
					data[fileObj.fieldname] = uploadedUrl;
				}
			} catch (err) {
				frappe.msgprint("File upload failed: " + err);
				return;
			}
		}

		const roommates = this.collect_roommates_data();
		for (let i = 0; i < roommates.length; i++) {
			let roommate = roommates[i];
			
			if (roommate.photo_file) {
				try {
					let uploadedUrl = await me.upload_file(roommate.photo_file, $("#guest").val());
					roommate.user_photo = uploadedUrl;
				} catch (err) {
					console.error(`Failed to upload photo for roommate ${i + 1}:`, err);
				}
			}
			
			delete roommate.photo_file;
			data.roommates.push(roommate);
		}

		frappe.call({
			method: "igusto.igusto.page.guest_onboard.guest_onboard.create_guest_onboarding",
			args: { data },
			callback: function (r) {
				if (!r.exc) {
					frappe.msgprint({
						title: __("Success"),
						message: __("Guest Onboarding Done Successfully"),
						indicator: "green"
					});
					frappe.set_route("Form", "Guest Onboarding", r.message);
				}
			}
		});
	}

	upload_file(file, docname) {
		return new Promise((resolve, reject) => {
			let formData = new FormData();
			formData.append("file", file);
			formData.append("is_private", 0);
			formData.append("doctype", "File");
			formData.append("docname", docname);

			$.ajax({
				url: "/api/method/upload_file",
				type: "POST",
				data: formData,
				processData: false,
				contentType: false,
				headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
				success: function (response) {
					if (response.message && response.message.file_url) {
						resolve(response.message.file_url);
					} else {
						reject("Upload failed");
					}
				},
				error: function (xhr) {
					console.error("File upload failed:", xhr);
					reject(xhr);
				}
			});
		});
	}
}
