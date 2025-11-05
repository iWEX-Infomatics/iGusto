frappe.pages['room-booking'].on_page_load = function (wrapper) {
	new RoomBooking(wrapper);
};

class RoomBooking {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Room Booking',
			single_column: true
		});
		this.make();
	}

	make() {
		$(frappe.render_template("room_booking")).appendTo(this.page.main);

		// Guest name from route
		let guestName = frappe?.route_options?.guest;
		if (guestName) $("#guest_name").val(guestName);

		this.load_room_types();

		// Handle Nationality
		$("#nationality").on("change", function () {
			if ($(this).val() === "Foreigner") {
				$("#currency-section").show();
				frappe.ui.form.make_control({
					df: {
						fieldtype: "Link",
						label: "Currency",
						fieldname: "currency",
						options: "Currency",
						reqd: 1
					},
					parent: $("#currency_wrapper"),
					render_input: true
				});
			} else {
				$("#currency-section").hide();
				$("#currency_wrapper").empty();
			}
		});

		//  Save Booking Button Click
		$("#create_booking_btn").on("click", (e) => {
			e.preventDefault();

			const bookingData = {
				guest: $("#guest_name").val(),
				mobile: $("#mobile").val(),
				email: $("#email").val(),
				check_in: $("#check_in").val(),
				check_out: $("#check_out").val(),
				no_of_guests: $("#no_of_guests").val(),
				room_type: $("#room_type").val(),
				nationality: $("#nationality").val(),
				currency: $("#currency_wrapper input").val() || ""
			};

			if (!bookingData.guest) return frappe.msgprint("⚠️ Please enter Guest name.");
			if (!bookingData.room_type) return frappe.msgprint("⚠️ Please select Room Type.");

			frappe.call({
				method: "igusto.igusto.page.room_booking.room_booking.create_booking",
				args: bookingData,
				callback: (r) => {
					if (r.message) {
						frappe.msgprint(" Booking Saved Successfully!");

						//  Create Guest Onboard button (green + fade animation)
						const onboardBtn = $(`
							<button class="booking-btn booking-btn-success" id="guest_onboard_btn" style="
								background-color: #28a745;
								color: white;
								border: none;
								padding: 10px 18px;
								border-radius: 10px;
								font-weight: 500;
								cursor: pointer;
								display: none;
							">
								Guest Onboard
							</button>
						`);

						// Replace and fade-in
						$("#create_booking_btn").fadeOut(200, function () {
							$(this).replaceWith(onboardBtn);
							onboardBtn.fadeIn(300);
						});

						//  On Guest Onboard click
						onboardBtn.on("click", () => {
							localStorage.setItem("last_booking", JSON.stringify({
								guest: bookingData.guest,
								from_date: bookingData.check_in,
								to_date: bookingData.check_out,
								no_of_guests: bookingData.no_of_guests,
								nationality: bookingData.nationality,
								room_type: bookingData.room_type
							}));

							frappe.set_route("guest-onboard", {
								guest: bookingData.guest,
								room_type: bookingData.room_type
							});
						});
					} else {
						frappe.msgprint(" Something went wrong while saving booking.");
					}
				}
			});
		});

		// Back button
		$("#back_btn").on("click", function () {
			frappe.set_route("app", "guest-signup");
		});
	}

	load_room_types() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Room Type",
				fields: ["name"]
			},
			callback: (r) => {
				if (r.message) {
					let options = `<option value="">Select Room Type</option>`;
					r.message.forEach(rt => {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$("#room_type_wrapper").html(`
						<select id="room_type" class="booking-input" required>
							${options}
						</select>
					`);
				}
			}
		});
	}
}
