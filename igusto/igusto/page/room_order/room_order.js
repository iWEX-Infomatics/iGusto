frappe.pages['room-order'].on_page_load = function (wrapper) {
	new RoomOrder(wrapper);
};

class RoomOrder {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true,
		});

		$(frappe.render_template('room_order', {})).appendTo(this.page.body);

		frappe.after_ajax(() => {
			this.load_autocomplete_lists();
			this.bind_events();
		});
	}

	// ---------------- Load dropdowns ----------------
	load_autocomplete_lists() {
		// ✅ Guests
		frappe.call({
			method: 'frappe.client.get_list',
			args: { doctype: 'Guest', fields: ['name'], limit_page_length: 100 },
			callback: (r) => {
				const $guest = $('#guest');
				$guest.empty().append(`<option value="">Select Guest</option>`);
				(r.message || []).forEach((g) => {
					$guest.append(`<option value="${g.name}">${g.name}</option>`);
				});
			},
		});

		// ✅ Room Assignments
		frappe.call({
			method: 'frappe.client.get_list',
			args: { doctype: 'Room Assignment', fields: ['name'], limit_page_length: 100 },
			callback: (r) => {
				const $ra = $('#room_assignment');
				$ra.empty().append(`<option value="">Select Room Assignment</option>`);
				(r.message || []).forEach((rm) => {
					$ra.append(`<option value="${rm.name}">${rm.name}</option>`);
				});
			},
		});

		// ✅ Rooms
		frappe.call({
			method: 'frappe.client.get_list',
			args: { doctype: 'Room', fields: ['name'], limit_page_length: 100 },
			callback: (r) => {
				const $room = $('#room');
				$room.empty().append(`<option value="">Select Room</option>`);
				(r.message || []).forEach((rm) => {
					$room.append(`<option value="${rm.name}">${rm.name}</option>`);
				});
			},
		});
	}

	// ---------------- Events ----------------
	bind_events() {
		console.log("Events bound");

		// ✅ Add item manually typed in the Service Item field
		$('#add_service_item').on('click', function () {
			const category = $('#service_type').val();
			const item = $('#service_item').val();
			const rate = parseFloat($('#service_rate').val()) || 0;

			if (!category || !item) {
				frappe.msgprint("Please enter both Service Type and Service Item.");
				return;
			}

			$('#order-items').append(`
				<div class="item-row border p-2 rounded mt-2" 
					data-item="${item}" 
					data-category="${category}" 
					data-rate="${rate}">
					
					<strong>${item}</strong> (${category}) - ₹${rate}
					<input type="number" class="quantity ml-2" value="1" min="1" data-rate="${rate}" />
					<span class="amount ml-2">₹${rate}</span>
					<button type="button" class="btn btn-sm btn-danger remove-item ml-2">X</button>
				</div>
			`);
			calculate_total();
			$('#service_item').val('');
			$('#service_rate').val('');
		});

		// Remove item
		$(document).on('click', '.remove-item', function () {
			$(this).closest('.item-row').remove();
			calculate_total();
		});

		// Update quantity
		$(document).on('input', '.quantity', function () {
			const qty = $(this).val();
			const rate = $(this).data('rate');
			const amount = qty * rate;
			$(this).siblings('.amount').text('₹' + amount);
			calculate_total();
		});

		function calculate_total() {
			let total = 0;
			$('.item-row').each(function () {
				const qty = $(this).find('.quantity').val();
				const rate = $(this).find('.quantity').data('rate');
				total += qty * rate;
			});
			$('#total_display').text('Total: ₹' + total.toFixed(2));
		}

		// ✅ Submit order
		$('#room-order-form').on('submit', function (e) {
			e.preventDefault();

			const data = {
				guest: $('#guest').val(),
				room_assignment: $('#room_assignment').val(),
				room: $('#room').val(),
				service_type: $('#service_type').val(),
				items: [],
			};

			$('.item-row').each(function () {
				data.items.push({
					item: $(this).data('item'),          // maps to item field
					category: $(this).data('category'),  // maps to category field
					quantity: parseFloat($(this).find('.quantity').val()),
					rate: $(this).data('rate'),
					amount: $(this).find('.quantity').val() * $(this).data('rate'),
				});
			});

			frappe.call({
				method: "igusto.igusto.page.room_order.room_order.create_service_order",
				args: { data: JSON.stringify(data) },
				freeze: true,
				freeze_message: 'Saving order...',
				callback: function (r) {
					if (r.message) {
						frappe.msgprint(` Order Created Successfully: ${r.message.name}`);
						$('#room-order-form')[0].reset();
						$('#order-items').empty();
						$('#total_display').text('');
					}
				},
			});
		});
	}
}
