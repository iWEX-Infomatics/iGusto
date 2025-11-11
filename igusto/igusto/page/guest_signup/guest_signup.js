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
	}

	make() {
		let me = this;
		this.$body = $(frappe.render_template("guest_signup")).appendTo(this.page.main);
		let guest_name = "";

		// Auto-fill Full Name
		const updateFullName = function() {
			const first = $('#first_name').val()?.trim() || '';
			const middle = $('#middle_name').val()?.trim() || '';
			const last = $('#last_name').val()?.trim() || '';
			const full_name = [first, middle, last].filter(Boolean).join(' ');
			$('#full_name').val(full_name);
		};
		$('#first_name, #middle_name, #last_name').on('input', updateFullName);

		//  Nationality logic
		$('#nationality').on('input', function () {
			const val = $(this).val()?.toLowerCase() || '';
			if (val === 'indian' || val === 'india') {
				$('#country').val('India').prop('readonly', true);
				$('#pincode').attr('placeholder', 'Pincode *');
			} else {
				$('#country').val('').prop('readonly', false);
				$('#pincode').attr('placeholder', 'Zip / Postal Code *');
			}
		});

		// 🟢 Pincode auto-fill (Indian only)
		$('#pincode').on('change', function () {
			const nationality = $('#nationality').val()?.toLowerCase();
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
						$('#city').val(po.taluk || po.post_office);
						$('#district').val(po.district);
						$('#state').val(po.state);
					}
				}
			});
		});

		//  Save Guest + Auto Create Address
		this.$body.find('#signup_btn').on('click', function () {
			const first = $('#first_name').val()?.trim();
			const middle = $('#middle_name').val()?.trim();
			const last = $('#last_name').val()?.trim();
			const full_name = $('#full_name').val();
			const mobile = $('#mobile_no').val();
			const email = $('#email').val();
			const nationality = $('#nationality').val();

			if (!first || !last || !mobile || !email) {
				frappe.msgprint('Please fill mandatory fields: First Name, Last Name, Mobile No, and Email.');
				return;
			}

			const address_data = {
				address_line1: $('#address_line1').val(),
				city: $('#city').val(),
				state: $('#state').val(),
				country: $('#country').val(),
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

						let normalizedNationality = nationality;
						if (nationality && (nationality.toLowerCase() === 'indian' || nationality.toLowerCase() === 'india')) {
							normalizedNationality = 'Indian';
						}

						const guestData = {
							guest: guest_name,
							mobile: mobile,
							email: email,
							nationality: normalizedNationality
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
