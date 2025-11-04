frappe.pages['guest-onboard'].on_page_load = function (wrapper) {
	new GuestOnboarding(wrapper);
};

class GuestOnboarding {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Guest Onboarding',
			single_column: true
		});
		this.make();
	}

	make() {
		let me = this;

		// Render HTML
		let html = frappe.render_template("guest_onboard", {});
		$(html).appendTo(this.page.body);

		// Wait for DOM ready
		setTimeout(() => {
			me.prefill_guest_and_fields();
		}, 300);

		this.page.body.find("#btn_submit_onboard").on("click", function () {
			me.submit_onboarding();
		});
	}

	prefill_guest_and_fields() {
		//  STEP 1: Load guest name from route or localStorage
		let guestName = frappe?.route_options?.guest || "";
		if (!guestName) {
			// fallback from localStorage (in case of page reload)
			const lastBooking = JSON.parse(localStorage.getItem("last_booking") || "{}");
			guestName = lastBooking.guest || "";
		}

		if (guestName) {
			$("#guest").val(guestName);
		} else {
			// fallback to current session user (optional)
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Guest",
					filters: { email: frappe.session.user },
					fieldname: ["name"]
				},
				callback: function (r) {
					if (r.message) {
						$("#guest").val(r.message.name);
					}
				}
			});
		}

		//  STEP 2: Load Room Types dynamically
		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Room Type", fields: ["name"] },
			callback: function (r) {
				if (r.message) {
					let options = `<option value="">Select Room Type</option>`;
					r.message.forEach(rt => {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$("#room_type").html(options);

					// Prefill from route or saved booking
					let room_type = frappe?.route_options?.room_type;
					if (!room_type) {
						const lastBooking = JSON.parse(localStorage.getItem("last_booking") || "{}");
						room_type = lastBooking.room_type || "";
					}
					if (room_type) $("#room_type").val(room_type);
				}
			}
		});

		//  STEP 3: Load Room Numbers (Room Doctype)
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

	submit_onboarding() {
		let data = {
			guest: $("#guest").val(),
			from_date: $("#from_date").val(),
			to_date: $("#to_date").val(),
			no_of_guests: $("#no_of_guests").val(),
			nationality: $("#nationality").val(),
			passport_number: $("#passport_number").val(),
			visa_number: $("#visa_number").val(),
			id_proof_type: $("#id_proof_type").val(),
			id_proof_number: $("#id_proof_number").val(),
			room_type: $("#room_type").val(),
			room_number: $("#room_number").val(),
			rfid_card_no: $("#rfid_card_no").val(),
			check_in_time: $("#check_in_time").val(),
			check_out_time: $("#check_out_time").val()
		};

		let file_input = $("#guest_photo")[0];
		let file = file_input.files[0];

		let upload_and_save = () => {
			frappe.call({
				method: "igusto.igusto.page.guest_onboard.guest_onboard.create_guest_onboarding",
				args: { data },
				callback: function (r) {
					if (!r.exc) {
						frappe.msgprint({
							title: __("Success"),
							message: __("Guest Onboarding Created: ") + r.message,
							indicator: "green"
						});
						frappe.set_route("Form", "Guest Onboarding", r.message);
					}
				}
			});
		};

		//  If photo is selected, upload it first
	if (file) {
		let formData = new FormData();
		formData.append("file", file);
		formData.append("is_private", 0);
		formData.append("doctype", "File");
		formData.append("docname", $("#guest").val());

		$.ajax({
			url: "/api/method/upload_file",
			type: "POST",
			data: formData,
			processData: false,
			contentType: false,
			headers: {
				"X-Frappe-CSRF-Token": frappe.csrf_token  //  Add this line
			},
			success: function (response) {
				if (response.message && response.message.file_url) {
					data.guest_photo = response.message.file_url;
				}
				upload_and_save();
			},
			error: function (xhr) {
				console.error("File upload failed:", xhr);
				frappe.msgprint(" File upload failed. Please try again.");
			}
		});
	} else {
		upload_and_save();
	}

	}

}
