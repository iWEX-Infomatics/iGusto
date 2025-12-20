frappe.pages['guest-signup'].on_page_load = function (wrapper) {
	new GuestSignupPage(wrapper);
};

class GuestSignupPage {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true
		});
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
		this.$body = $(frappe.render_template("guest_signup")).appendTo(this.page.main);

		// Create Nationality Link field
		setTimeout(() => {
			me.nationality_field = frappe.ui.form.make_control({
				df: {
					fieldtype: "Link",
					fieldname: "nationality",
					options: "Country",
					placeholder: "Nationality *"
				},
				parent: me.$body.find("#nationality"),
				render_input: true
			});
			me.nationality_field.refresh();
		}, 100);

		// Auto-fill Full Name
		const updateFullName = function() {
			const first = $('#first_name').val()?.trim() || '';
			const middle = $('#middle_name').val()?.trim() || '';
			const last = $('#last_name').val()?.trim() || '';
			const full_name = [first, middle, last].filter(Boolean).join(' ');
			$('#full_name').val(full_name);
		};
		$('#first_name, #middle_name, #last_name').on('input', updateFullName);

		// Auto-format Mobile for +91
		$('#mobile_no').on('input', function () {
			const countryCode = $('#country_code').val().trim();
			let val = $(this).val().replace(/\s/g, '');

			if (countryCode === '+91') {
				if (val.length > 5) {
					val = val.slice(0, 5) + ' ' + val.slice(5, 10);
				}
			}
			$(this).val(val);
		});

		// Post office dropdown setup
		const $postOfficeContainer = $('#post_office_dropdown_container');
		const $postOfficeDropdown = $('#post_office_dropdown');
		const $postOfficeLoader = $('#post_office_loader');
		const $pincodeField = $('#pincode');
		
		if ($pincodeField.length && $postOfficeContainer.length) {
			$postOfficeContainer.insertAfter($pincodeField);
		}

		const hidePostOfficeSection = function(clear = true) {
			$postOfficeContainer.hide();
			$postOfficeLoader.addClass('hidden');
			$postOfficeDropdown.show().prop('disabled', false);
			if (clear) {
				$postOfficeDropdown.val('').data('offices', null);
			}
		};

		const showPostOfficeLoader = function() {
			$postOfficeContainer.show();
			$postOfficeLoader.removeClass('hidden');
			$postOfficeDropdown.hide().prop('disabled', true);
		};

		const showPostOfficeDropdown = function() {
			$postOfficeLoader.addClass('hidden');
			$postOfficeDropdown.show().prop('disabled', false);
		};

		hidePostOfficeSection();

		// Nationality logic
		setTimeout(() => {
			if (me.nationality_field && me.nationality_field.$input) {
				$(me.nationality_field.$input).on('change', function () {
					const val = me.nationality_field.get_value()?.toLowerCase() || '';
					if (val === 'indian' || val === 'india') {
						$('#pincode').attr('placeholder', 'Pincode *');
						$('#country_code').val('+91');
					} else {
						$('#pincode').attr('placeholder', 'Zip / Postal Code *');
						hidePostOfficeSection();
					}
				});
			}
		}, 200);

		const isMobileScreen = function() {
			return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
		};

		const set_address_fields = function(po) {
			$('#post_office').val(po.post_office);
			$('#district').val(po.district);
			$('#state').val(po.state);
		};

		$postOfficeDropdown.on('change', function() {
			const selectedIndex = $(this).val();
			if (selectedIndex === '' || selectedIndex === null) return;
			
			const offices = $(this).data('offices');
			if (offices && offices[selectedIndex]) {
				set_address_fields(offices[selectedIndex]);
			}
		});

		const isValidPincode = function(pincode) {
			return pincode && pincode.length === 6 && /^\d{6}$/.test(pincode);
		};

		$('#pincode').on('input', function() {
			const pincode = $(this).val().trim();
			if (!isValidPincode(pincode)) {
				hidePostOfficeSection();
			}
		});

		$('#pincode').on('blur', function() {
			const pincode = $(this).val().trim();
			if (!isValidPincode(pincode)) {
				hidePostOfficeSection();
			}
		});

		// Pincode auto-fill
		$('#pincode').on('change', function () {
			const nationality = (me.nationality_field && me.nationality_field.get_value())?.toLowerCase() || '';
			if (nationality !== 'indian' && nationality !== 'india') {
				hidePostOfficeSection();
				return;
			}

			const pincode = $(this).val().trim();
			if (!isValidPincode(pincode)) {
				frappe.msgprint("Please enter a valid 6-digit Pincode.");
				hidePostOfficeSection();
				return;
			}

			if (isMobileScreen()) {
				showPostOfficeLoader();
			}

			frappe.call({
				method: "igusto.igusto.page.guest_signup.guest_signup.get_post_offices_api",
				args: { pincode },
				callback: function (r) {
					const offices = r.message;
					if (!Array.isArray(offices) || offices.length === 0) {
						frappe.msgprint("No Post Office found for this Pincode.");
						hidePostOfficeSection();
						return;
					}

					if (offices.length === 1) {
						set_address_fields(offices[0]);
						hidePostOfficeSection();
					} else {
						if (isMobileScreen()) {
							const $dropdown = $postOfficeDropdown;
							$dropdown.empty().append('<option value="">Select Post Office</option>');
							
							offices.forEach((office, index) => {
								const optionText = `${office.post_office} - ${office.district}, ${office.state}`;
								$dropdown.append(`<option value="${index}">${optionText}</option>`);
							});
							
							$dropdown.data('offices', offices);
							showPostOfficeDropdown();
							$postOfficeContainer.show();
						} else {
							const options = offices.map((o, i) => ({ label: o.post_office, value: i }));
							const d = new frappe.ui.Dialog({
								title: 'Select Post Office',
								fields: [{ label: 'Post Office', fieldname: 'selected_po', fieldtype: 'Select', options }],
								primary_action_label: 'Insert',
								primary_action({ selected_po }) {
									if (!selected_po) {
										frappe.msgprint('Please select a Post Office.');
										return;
									}
									set_address_fields(offices[+selected_po]);
									d.hide();
								}
							});
							d.show();
							hidePostOfficeSection();
						}
					}
				},
				error: function() {
					hidePostOfficeSection();
				}
			});
		});

		// 🔥 UPDATED: Save button - Store data and redirect to verification
		this.$body.find('#signup_btn').on('click', function () {
			const first = $('#first_name').val()?.trim();
			const middle = $('#middle_name').val()?.trim();
			const last = $('#last_name').val()?.trim();
			const full_name = $('#full_name').val();
			const mobile = $('#mobile_no').val()?.replace(/\s/g, '');
			const email = $('#email').val();
			const nationality = (me.nationality_field && me.nationality_field.get_value()) || '';

			if (!first || !last || !mobile || !email || !nationality) {
				frappe.msgprint('Please fill mandatory fields: First Name, Last Name, Mobile No, Email, and Nationality.');
				return;
			}

			// Collect all guest data
			const guestData = {
				first_name: first,
				middle_name: middle,
				last_name: last,
				full_name: full_name,
				mobile_no: mobile,
				email: email,
				gender: $('#gender').val(),
				nationality: nationality,
				address_data: {
					address_line1: $('#address_line1').val(),
					city: $('#city').val(),
					state: $('#state').val(),
					country: nationality,
					pincode: $('#pincode').val(),
					post_office: $('#post_office').val(),
					district: $('#district').val(),
				}
			};

			// Store in localStorage
			localStorage.setItem("guest_signup_data", JSON.stringify(guestData));

			// Send OTP
			frappe.call({
				method: "igusto.igusto.page.verification.verification.send_otp",
				args: {
					email: email,
					mobile_no: mobile
				},
				callback: function (r) {
					if (r.message && r.message.success) {
						frappe.show_alert({
							message: r.message.message,
							indicator: 'green'
						});
						
						// Redirect to verification page
						frappe.set_route('verification');
					} else {
						frappe.msgprint(r.message.message || 'Failed to send OTP');
					}
				}
			});
		});
	}
}