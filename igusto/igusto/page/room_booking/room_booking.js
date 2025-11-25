frappe.pages['room-booking'].on_page_load = function (wrapper) {
	new RoomBooking(wrapper);
};

class RoomBooking {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true
		});
		this.make();
	}

	make() {
		$(frappe.render_template("room_booking")).appendTo(this.page.main);

		frappe.after_ajax(() => {
			this.create_nationality_field();
			this.load_guest_data();
			this.load_room_types();
			this.setup_events();
			this.load_company_details();
		});
	}

	create_nationality_field() {
		let me = this;
		setTimeout(() => {
			me.nationality_field = frappe.ui.form.make_control({
				df: {
					fieldtype: "Link",
					fieldname: "nationality",
					options: "Country",
					// label: "Nationality",
					// reqd: 1,
					placeholder: "Nationality *"
				},
				parent: $("#nationality"),
				render_input: true
			});
			if (me.nationality_field) {
				me.nationality_field.refresh();
			}
		}, 100);
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

      // HARD CODED ADDRESS ONLY
      const address_line = "Munnar";

      // Dynamic phone + email
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

	load_guest_data() {
		let storedGuest = localStorage.getItem("guest_data");
		if (!storedGuest) {
			// //console.warn(" No guest data found");
			return;
		}

		try {
			const guestData = JSON.parse(storedGuest);
			// //console.log(" Loaded guest data:", guestData);

			//  CRITICAL FIX: Use .booking-card context to target only visible form fields
			const $form = $(".booking-card");
			let me = this;

			setTimeout(() => {
				if (guestData.guest) {
					$form.find("#guest_name").val(guestData.guest);
					//console.log(" Guest Name set:", guestData.guest);
				}

				if (guestData.mobile) {
					$form.find("#mobile").val(guestData.mobile);
					//console.log(" Mobile set:", guestData.mobile);
				}

				//  FIX: Target visible email field only
				if (guestData.email) {
					$form.find("#email").val(guestData.email);
					//console.log(" Email set:", guestData.email);
					
					// Verify it worked
					setTimeout(() => {
						const currentVal = $form.find("#email").val();
						//console.log("📧 Email verification:", currentVal);
					}, 100);
				}

				//  FIX: Target visible nationality field only - wait for field to be ready
				if (guestData.nationality) {
					let normalizedNat = guestData.nationality;
					// Convert "Indian" or "india" to "India" for Country link
					if (normalizedNat.toLowerCase() === 'indian' || normalizedNat.toLowerCase() === 'india') {
						normalizedNat = 'India';
					}
					
					// Function to set nationality value - retries if field not ready
					const setNationalityValue = () => {
						if (me.nationality_field && me.nationality_field.set_value) {
							try {
								me.nationality_field.set_value(normalizedNat);
								if (me.nationality_field.$input) {
									me.nationality_field.$input.trigger("change");
								}
								//console.log(" Nationality set:", normalizedNat);
							} catch (err) {
								//console.error(" Error setting nationality:", err);
								// Retry after delay
								setTimeout(setNationalityValue, 200);
							}
						} else {
							// Field not ready yet, retry after delay
							setTimeout(setNationalityValue, 100);
						}
					};
					
					// Start trying to set the value after a short delay
					setTimeout(setNationalityValue, 300);
				}
			}, 300);

		} catch (e) {
			//console.error(" Failed to parse guest data:", e);
		}
	}

	setup_events() {
		const $form = $(".booking-card");
		let me = this;

		//  Nationality change event - scoped to booking form
		setTimeout(() => {
			if (me.nationality_field && me.nationality_field.$input) {
				$(me.nationality_field.$input).on("change", function () {
					const nationality = me.nationality_field.get_value() || "";
					//console.log(" Nationality changed to:", nationality);
					
					// Check if country is not India (foreigner)
					if (nationality && nationality.toLowerCase() !== "india") {
						$("#currency-section").show();
						$("#currency_wrapper").empty();
						
						me.currency_field = frappe.ui.form.make_control({
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
						me.currency_field.refresh();
					} else {
						$("#currency-section").hide();
						$("#currency_wrapper").empty();
						me.currency_field = null;
					}
				});
			}
		}, 200);

		//  Save Booking - scoped to booking form
		$form.on("click", "#create_booking_btn", function (e) {
			e.preventDefault();

			//  Get values from booking form only (not hidden guest signup form)
		const bookingData = {
		guest: $form.find("#guest_name").val()?.trim() || "",
		mobile: $form.find("#mobile").val()?.trim() || "",
		email: $form.find("#email").val()?.trim() || "",
		check_in: $form.find("#check_in").val() || "",
		check_out: $form.find("#check_out").val() || "",
		no_of_guests: $form.find("#no_of_guests").val() || "",
		room_type: $form.find("#room_type").val() || "",
		rate_plan: $form.find("#rate_plan").val() || "",   //  Added line here
		nationality: (me.nationality_field && me.nationality_field.get_value()) || "",
		currency: (me.currency_field && me.currency_field.get_value()) || ""
		};




			// Validation
			if (!bookingData.guest) {
				frappe.msgprint(" Guest name is required.");
				$form.find("#guest_name").focus();
				return;
			}
			if (!bookingData.mobile) {
				frappe.msgprint(" Mobile number is required.");
				$form.find("#mobile").focus();
				return;
			}
			if (!bookingData.email) {
				frappe.msgprint(" Email is required.");
				$form.find("#email").focus();
				return;
			}
			if (!bookingData.check_in || !bookingData.check_out) {
				frappe.msgprint(" Check-in and Check-out dates are required.");
				return;
			}
			if (!bookingData.no_of_guests || bookingData.no_of_guests < 1) {
				frappe.msgprint(" Number of guests is required.");
				$form.find("#no_of_guests").focus();
				return;
			}
			if (!bookingData.room_type) {
				frappe.msgprint(" Room type is required.");
				return;
			}

			if (!bookingData.rate_plan) {
				frappe.msgprint(" Rate Plan is required.");
				$form.find("#rate_plan").focus();
				return;
			}


			if (!bookingData.nationality) {
				frappe.msgprint(" Nationality is required.");
				$form.find("#nationality").focus();
				return;
			}
			if (bookingData.nationality && bookingData.nationality.toLowerCase() !== "india" && !bookingData.currency) {
				frappe.msgprint(" Currency is required for foreign guests.");
				return;
			}

			frappe.call({
				method: "igusto.igusto.page.room_booking.room_booking.create_booking",
				args: bookingData,
				callback: function (r) {
					if (r.message) {
						frappe.msgprint(" Room Booking Done Successfully!");
						localStorage.removeItem("guest_data");
						// //console.log("🗑️ Cleared guest_data from localStorage");
					}
				},
				error: function (err) {
					// //console.error(" Booking Error:", err);
					frappe.msgprint(" Failed to create booking.");
				}
			});
		});

		// Back button
		$form.on("click", "#back_btn", function () {
			frappe.set_route("guest-signup");
		});
	}

	load_room_types() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Room Type",
				fields: ["name"]
			},
			callback: function (r) {
				if (r.message && r.message.length > 0) {
					let options = `<option value="">Select Room Type</option>`;
					r.message.forEach(function (rt) {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$("#room_type_wrapper").html(`
						<select id="room_type" class="booking-input" required>
							${options}
						</select>
					`);
					// //console.log(" Room types loaded:", r.message.length);
				}
			}
		});
	}
}