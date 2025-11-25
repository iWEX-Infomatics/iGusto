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



	make() {
		let me = this;
		this.$body = $(frappe.render_template("guest_signup")).appendTo(this.page.main);
		let guest_name = "";

		// Create Nationality Link field
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

		// 🟢 Auto-format Mobile for +91 (space after 5 digits)
		$('#mobile_no').on('input', function () {
			const countryCode = $('#country_code').val().trim();
			let val = $(this).val().replace(/\s/g, ''); // remove all spaces

			if (countryCode === '+91') {
				if (val.length > 5) {
					val = val.slice(0, 5) + ' ' + val.slice(5, 10);
				}
			}
			$(this).val(val);
		});

		// Nationality logic - set up after field is created
		setTimeout(() => {
			if (me.nationality_field && me.nationality_field.$input) {
				$(me.nationality_field.$input).on('change', function () {
					const val = me.nationality_field.get_value()?.toLowerCase() || '';
					if (val === 'indian' || val === 'india') {
						$('#pincode').attr('placeholder', 'Pincode *');
						$('#country_code').val('+91');
					} else {
						$('#pincode').attr('placeholder', 'Zip / Postal Code *');
					}
				});
			}
		}, 200);

		// 🟢 Pincode auto-fill (Indian only)
		$('#pincode').on('change', function () {
			const nationality = (me.nationality_field && me.nationality_field.get_value())?.toLowerCase() || '';
			if (nationality !== 'indian' && nationality !== 'india') return;

			const pincode = $(this).val();
			if (!pincode || pincode.length !== 6) {
				frappe.msgprint("Please enter a valid 6-digit Pincode.");
				return;
			}

			frappe.call({
				method: "igusto.igusto.page.guest_signup.guest_signup.get_post_offices_api",
				args: { pincode },
				callback: function (r) {
					const offices = r.message;
					if (!Array.isArray(offices) || offices.length === 0) {
						frappe.msgprint("No Post Office found for this Pincode.");
						return;
					}

					if (offices.length === 1) {
						set_address_fields(offices[0]);
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
					}

					function set_address_fields(po) {
						$('#post_office').val(po.post_office);
						$('#district').val(po.district);
						$('#state').val(po.state);
						// 🔴 Removed city autofill intentionally as per requirement
					}
				}
			});
		});

		// Save Guest + Auto Create Address
		this.$body.find('#signup_btn').on('click', function () {
			const first = $('#first_name').val()?.trim();
			const middle = $('#middle_name').val()?.trim();
			const last = $('#last_name').val()?.trim();
			const full_name = $('#full_name').val();
			const mobile = $('#mobile_no').val()?.replace(/\s/g, ''); // remove space before saving
			const email = $('#email').val();
			const nationality = (me.nationality_field && me.nationality_field.get_value()) || '';

			if (!first || !last || !mobile || !email || !nationality) {
				frappe.msgprint('Please fill mandatory fields: First Name, Last Name, Mobile No, Email, and Nationality.');
				return;
			}

			const address_data = {
				address_line1: $('#address_line1').val(),
				city: $('#city').val(),
				state: $('#state').val(),
				country: nationality, // Use nationality (Country) as the address country
				pincode: $('#pincode').val(),
				post_office: $('#post_office').val(),
				district: $('#district').val(),
			};

			frappe.call({
				method: "igusto.igusto.page.guest_signup.guest_signup.create_guest_with_address",
				args: {
					first_name: first,
					middle_name: middle,
					last_name: last,
					full_name: full_name,
					mobile_no: mobile,
					email: email,
					gender: $('#gender').val(),
					nationality: nationality,
					address_data: address_data
				},
				callback: function (r) {
					if (r.message) {
						guest_name = r.message.guest;

						const guestData = {
							guest: guest_name,
							mobile: mobile,
							email: email,
							nationality: nationality
						};
						localStorage.setItem("guest_data", JSON.stringify(guestData));

						$('#success-msg')
							.text(`Signup Completed!`)
							.removeClass('hidden');
						$('#book_now_btn').removeClass('hidden');
						$('#signup_btn').addClass('hidden');
					}
				}
			});
		});

		// Book Now
		this.$body.find('#book_now_btn').on('click', function () {
			if (!guest_name) {
				frappe.msgprint("Guest not found, please register first!");
				return;
			}
			frappe.set_route('room-booking', { guest: guest_name });
		});
	}
}
