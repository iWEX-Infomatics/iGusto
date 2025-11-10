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

		// ✅ Wait till DOM loads before filling data
		frappe.after_ajax(() => {
			// ✅ CRITICAL FIX: Use setTimeout with callback chain
			setTimeout(() => {
				this.load_guest_data();
			}, 300);
			
			this.load_room_types();
			this.setup_events();
		});
	}

	load_guest_data() {
		let storedGuest = localStorage.getItem("guest_data");
		
		if (!storedGuest) {
			console.warn("⚠️ No guest data found in localStorage");
			return;
		}

		try {
			const guestData = JSON.parse(storedGuest);
			console.log("📥 Loaded from localStorage:", guestData);

			// ✅ FIXED: Direct assignment without nested setTimeout
			if (guestData.guest) {
				const guestField = $("#guest_name");
				if (guestField.length) {
					guestField.val(guestData.guest);
					console.log("✅ Guest Name set:", guestData.guest);
				} else {
					console.error("❌ #guest_name field not found in DOM");
				}
			}

			if (guestData.mobile) {
				const mobileField = $("#mobile");
				if (mobileField.length) {
					mobileField.val(guestData.mobile);
					console.log("✅ Mobile set:", guestData.mobile);
				} else {
					console.error("❌ #mobile field not found in DOM");
				}
			}

			// ✅ CRITICAL FIX: Email was missing proper field assignment
			if (guestData.email) {
				const emailField = $("#email");
				if (emailField.length) {
					emailField.val(guestData.email);
					console.log("✅ Email set:", guestData.email);
				} else {
					console.error("❌ #email field not found in DOM");
				}
			}

			// ✅ CRITICAL FIX: Nationality needs proper value matching
			if (guestData.nationality) {
				const nationalityField = $("#nationality");
				if (nationalityField.length) {
					// ✅ Ensure exact match with dropdown options
					let nationalityValue = guestData.nationality;
					
					// Normalize to match dropdown options exactly
					if (nationalityValue.toLowerCase() === 'indian' || nationalityValue.toLowerCase() === 'india') {
						nationalityValue = 'Indian';
					} else if (nationalityValue.toLowerCase() === 'foreigner' || nationalityValue.toLowerCase() === 'foreign') {
						nationalityValue = 'Foreigner';
					}
					
					nationalityField.val(nationalityValue);
					console.log("✅ Nationality set:", nationalityValue);
					
					// ✅ Trigger change event to show currency field if needed
					nationalityField.trigger("change");
				} else {
					console.error("❌ #nationality field not found in DOM");
				}
			}

		} catch (e) {
			console.error("❌ Failed to parse localStorage data:", e);
			frappe.msgprint("Error loading guest data. Please re-enter your details.");
		}
	}

	setup_events() {
		// Handle Nationality Change
		$("#nationality").on("change", function () {
			const nationality = $(this).val();
			console.log("🌍 Nationality changed to:", nationality);
			
			if (nationality === "Foreigner") {
				$("#currency-section").show();
				$("#currency_wrapper").empty(); // Clear previous field
				
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

		// Save Booking
		$("#create_booking_btn").on("click", (e) => {
			e.preventDefault();

			const bookingData = {
				guest: $("#guest_name").val().trim(),
				mobile: $("#mobile").val().trim(),
				email: $("#email").val().trim(),
				check_in: $("#check_in").val(),
				check_out: $("#check_out").val(),
				no_of_guests: $("#no_of_guests").val(),
				room_type: $("#room_type").val(),
				nationality: $("#nationality").val(),
				currency: $("#currency_wrapper input").val() || ""
			};

			console.log("📝 Booking Data:", bookingData);

			// ✅ Enhanced validation
			if (!bookingData.guest) {
				frappe.msgprint("⚠️ Please enter Guest name.");
				$("#guest_name").focus();
				return;
			}
			if (!bookingData.mobile) {
				frappe.msgprint("⚠️ Please enter Mobile number.");
				$("#mobile").focus();
				return;
			}
			if (!bookingData.email) {
				frappe.msgprint("⚠️ Please enter Email.");
				$("#email").focus();
				return;
			}
			if (!bookingData.check_in || !bookingData.check_out) {
				frappe.msgprint("⚠️ Please select Check-in and Check-out dates.");
				return;
			}
			if (!bookingData.no_of_guests || bookingData.no_of_guests < 1) {
				frappe.msgprint("⚠️ Please enter number of guests.");
				$("#no_of_guests").focus();
				return;
			}
			if (!bookingData.room_type) {
				frappe.msgprint("⚠️ Please select Room Type.");
				return;
			}
			if (!bookingData.nationality) {
				frappe.msgprint("⚠️ Please select Nationality.");
				$("#nationality").focus();
				return;
			}
			if (bookingData.nationality === "Foreigner" && !bookingData.currency) {
				frappe.msgprint("⚠️ Please select Currency for foreign guests.");
				return;
			}

			frappe.call({
				method: "igusto.igusto.page.room_booking.room_booking.create_booking",
				args: bookingData,
				callback: (r) => {
					if (r.message) {
						frappe.msgprint("✅ Room Booking Done Successfully!");
						
						// ✅ Clear localStorage after successful booking
						localStorage.removeItem("guest_data");
						console.log("🗑️ Cleared guest_data from localStorage");

						// ✅ Show Guest Onboard button
						const onboardBtn = $(`
							<button class="booking-btn booking-btn-success" id="guest_onboard_btn" style="
								background-color: #28a745;
								color: white;
								border: none;
								padding: 10px 18px;
								border-radius: 10px;
								font-weight: 600;
								cursor: pointer;
								width: 100%;
								margin-top: 1rem;
							">
								Guest Onboard
							</button>
						`);

						$("#create_booking_btn").fadeOut(200, function () {
							$(this).replaceWith(onboardBtn);
							onboardBtn.fadeIn(300);
						});

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
						frappe.msgprint("❌ Something went wrong while saving booking.");
					}
				},
				error: (err) => {
					console.error("❌ Booking Error:", err);
					frappe.msgprint("❌ Failed to create booking. Please try again.");
				}
			});
		});

		// Back button
		$("#back_btn").on("click", function () {
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
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					let options = `<option value="">Select Room Type</option>`;
					r.message.forEach(rt => {
						options += `<option value="${rt.name}">${rt.name}</option>`;
					});
					$("#room_type_wrapper").html(`
						<select id="room_type" class="booking-input" required>
							${options}
						</select>
					`);
					console.log("✅ Room types loaded:", r.message.length);
				} else {
					console.warn("⚠️ No room types found");
					$("#room_type_wrapper").html(`
						<select id="room_type" class="booking-input" required disabled>
							<option value="">No Room Types Available</option>
						</select>
					`);
				}
			},
			error: (err) => {
				console.error("❌ Failed to load room types:", err);
			}
		});
	}
}