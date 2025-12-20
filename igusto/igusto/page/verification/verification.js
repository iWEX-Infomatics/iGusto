frappe.pages['verification'].on_page_load = function(wrapper) {
	new VerificationPage(wrapper);
};

class VerificationPage {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true
		});
		this.guest_name = null;
		this.mobile_verified = false;
		this.email_verified = false;
		this.make();
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
		this.load_company_details();
		this.$body = $(frappe.render_template("verification")).appendTo(this.page.main);

		// Load guest data from localStorage
		const guestData = localStorage.getItem("guest_signup_data");
		
		if (!guestData) {
			frappe.msgprint({
				title: 'No Data Found',
				message: 'Please complete the signup form first.',
				indicator: 'red'
			});
			frappe.set_route('guest-signup');
			return;
		}

		const data = JSON.parse(guestData);

		// Prefill mobile and email (read-only)
		$('#mobile_display').val(data.mobile_no);
		$('#email_display').val(data.email);

		// Verify OTP Button
		this.$body.find('#verify_btn').on('click', function() {
			const mobileOtp = $('#mobile_otp').val().trim();
			const emailOtp = $('#email_otp').val().trim();

			// Validation - at least one OTP must be entered
			if (!mobileOtp && !emailOtp) {
				me.showError('Please enter at least one OTP (Mobile or Email)');
				return;
			}

			// Validate format if OTP is entered
			if (mobileOtp && (mobileOtp.length !== 6 || !/^\d{6}$/.test(mobileOtp))) {
				me.showError('Please enter a valid 6-digit Mobile OTP');
				return;
			}

			if (emailOtp && (emailOtp.length !== 6 || !/^\d{6}$/.test(emailOtp))) {
				me.showError('Please enter a valid 6-digit Email OTP');
				return;
			}

			// Hide previous messages
			$('#error-msg, #success-msg').addClass('hidden');

			// Call verification API
			frappe.call({
				method: "igusto.igusto.page.verification.verification.verify_otp",
				args: {
					email: data.email,
					mobile_no: data.mobile_no,
					mobile_otp: mobileOtp || null,
					email_otp: emailOtp || null
				},
				callback: function(r) {
					if (r.message && r.message.success) {
						// Track which OTPs were verified
						me.mobile_verified = r.message.mobile_verified || false;
						me.email_verified = r.message.email_verified || false;

						// If at least one OTP is verified, create guest
						if (me.mobile_verified || me.email_verified) {
							frappe.call({
								method: "igusto.igusto.page.verification.verification.create_guest_after_verification",
								args: {
									guest_data: data
								},
								callback: function(response) {
									if (response.message && response.message.success) {
										me.guest_name = response.message.guest;
										
										// 🔥 Store guest data in localStorage for booking page
										const guestBookingData = {
											guest: me.guest_name,
											full_name: data.full_name,
											mobile: data.mobile_no,
											email: data.email,
											nationality: data.nationality
										};
										localStorage.setItem("guest_data", JSON.stringify(guestBookingData));
										console.log("✅ Guest data stored in localStorage for booking:", guestBookingData);
										
										// Show success message
										let successMsg = 'Verification Successful! ';
										if (me.mobile_verified && me.email_verified) {
											successMsg += '(Both Mobile & Email verified)';
										} else if (me.mobile_verified) {
											successMsg += '(Mobile verified)';
										} else if (me.email_verified) {
											successMsg += '(Email verified)';
										}
										$('#success-msg').text(successMsg).removeClass('hidden');
										
										// Disable verified OTP fields
										if (me.mobile_verified) {
											$('#mobile_otp').prop('disabled', true);
										}
										if (me.email_verified) {
											$('#email_otp').prop('disabled', true);
										}
										
										// Hide verify button, show Book Now
										$('#verify_btn').addClass('hidden');
										$('#book_now_btn').removeClass('hidden');
										
										// Clear signup data from localStorage
										localStorage.removeItem("guest_signup_data");
										
										frappe.show_alert({
											message: 'Guest created successfully!',
											indicator: 'green'
										});
									} else {
										me.showError(response.message.message || 'Failed to create guest');
									}
								}
							});
						}
					} else {
						// OTP verification failed - show resend button
						me.showError(r.message.message || 'Invalid OTP. Please check and try again.');
						$('#resend_btn').removeClass('hidden');
					}
				},
				error: function() {
					me.showError('Verification failed. Please try again.');
					$('#resend_btn').removeClass('hidden');
				}
			});
		});

		// Resend OTP Button
		this.$body.find('#resend_btn').on('click', function() {
			// Clear OTP fields
			$('#mobile_otp').val('');
			$('#email_otp').val('');
			
			// Hide messages
			$('#error-msg, #success-msg').addClass('hidden');

			// Send new OTP
			frappe.call({
				method: "igusto.igusto.page.verification.verification.send_otp",
				args: {
					email: data.email,
					mobile_no: data.mobile_no
				},
				callback: function(r) {
					if (r.message && r.message.success) {
						frappe.show_alert({
							message: 'New OTP sent to your email',
							indicator: 'green'
						});
						
						// Hide resend button, show verify button
						$('#resend_btn').addClass('hidden');
						$('#verify_btn').removeClass('hidden');
					} else {
						me.showError('Failed to resend OTP. Please try again.');
					}
				}
			});
		});

		// Book Now Button
		this.$body.find('#book_now_btn').on('click', function() {
			if (!me.guest_name) {
				frappe.msgprint("Guest not found!");
				return;
			}
			
			// Verify guest data is stored in localStorage
			const storedData = localStorage.getItem("guest_data");
			if (!storedData) {
				frappe.msgprint("Guest data not found. Please try again.");
				return;
			}
			
			// Navigate to room booking page
			frappe.set_route('room-booking');
		});

		// Allow Enter key to submit
		$('#mobile_otp, #email_otp').on('keypress', function(e) {
			if (e.which === 13) {
				$('#verify_btn').click();
			}
		});
	}

	showError(message) {
		$('#error-msg').text(message).removeClass('hidden');
		$('#success-msg').addClass('hidden');
	}
}