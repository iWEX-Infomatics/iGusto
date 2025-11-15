frappe.pages['room-order'].on_page_load = function (wrapper) {
  new RoomOrder(wrapper);
};

class RoomOrder {
  constructor(wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: '',
      single_column: true
    });
    this.make();
    this.load_company_details();
    this.load_room_numbers();

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

        let address_html = data.address ? data.address : "";

const hasCustomAddress = data.custom_address && data.custom_address.trim() !== "";

let contact_html = "";

// Show phone + email only when custom_address is NOT present
if (!hasCustomAddress) {
  if (typeof data.phone === "string" && data.phone.trim() !== "") {
    contact_html += data.phone;
  }

  if (typeof data.email === "string" && data.email.trim() !== "") {
    // Add comma only if phone also exists
    contact_html += (contact_html ? ", " : "") + data.email;
  }
}

        const header_html = `
  <div class="company-header-inner">
    <div class="company-left">${logo_html}</div>
    <div class="company-right">
      <h2 class="company-name">${data.company_name}</h2>
      <div class="company-details">
        ${address_html ? `<div>${address_html}</div>` : ""}
        ${contact_html ? `<div>${contact_html}</div>` : ""}
      </div>
    </div>
  </div>
`;

        $(".company-header-wrapper").remove();
        $(".combined-card .company-header").html(header_html);

      }
    });
  }


  make() {
    $(frappe.render_template("room_order", {})).appendTo(this.page.body);

    const urlParams = new URLSearchParams(window.location.search);
    const qr_room_number = urlParams.get("room_number");

    if (qr_room_number) {
      // Fill "Order From" field
      const $orderFrom = $("input[placeholder='Enter Room Number']");
      $orderFrom
        .val(qr_room_number)
        .prop("readonly", true)
        .css({
          background: "#f5f5f5",
          fontWeight: "600",
          color: "#333",
        });

      // frappe.show_alert({
      //   message: `Room ${qr_room_number} detected from QR!`,
      //   indicator: "green",
      // });

      // Fetch and fill guest name
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_guest_by_room",
        args: { room_number: qr_room_number },
        callback: function (r) {
          console.log("Guest Response:", r);
          if (r.message) {
            $("#guest_name").val(r.message);
          } else {
            frappe.msgprint("No guest found for this room.");
          }
        }
      });
    }

    // listeners
    $("#service_type").on("change", (e) => {
      this.render_dynamic_fields(e.target.value);
    });

    $("#room_number").on("change", (e) => {
      const room = e.target.value;
      if (room) {
        this.fetch_guest_for_room(room);
      } else {
        $("#guest_name").val("");
      }
    });

    $("#submit_order").on("click", () => {
      this.submit_order();
    });
  }

  load_room_numbers() {
    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.get_room_numbers",
      callback: (r) => {
        if (r.message) {
          const sel = $("#room_number");
          sel.empty();
          sel.append(`<option value="">Select Room Number</option>`);
          r.message.forEach(rn => {
            sel.append(`<option value="${frappe.utils.escape_html(rn)}">${frappe.utils.escape_html(rn)}</option>`);
          });
        }
      }
    });
  }

  fetch_guest_for_room(room_number) {
    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.get_guest_by_room",
      args: { room_number },
      callback: (r) => {
        if (r.message) {
          $("#guest_name").val(r.message);
        } else {
          $("#guest_name").val("");
          frappe.msgprint("No guest found for selected room.");
        }
      }
    });
  }

  render_dynamic_fields(service_type) {
    const container = $("#dynamic_input");
    container.empty();

    if (!service_type) return;

    // RESTAURANT
    if (service_type === "Restaurant") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_menu_items",
        callback: (r) => {
          if (r.message) {
            let html = `
        <div class="child-table-wrapper">
          <table class="child-table" id="restaurant_table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <button type="button" class="add-row-btn" id="add_row_btn">+ Add Row</button>
      `;

            container.html(html);

            const addRow = () => {
              const options = r.message
                .map(i => `<option value="${i.item_name}">${i.item_name}</option>`)
                .join("");
              const row = `
            <tr>
              <td><select class="form-control-col item_name"><option value="">Select</option>${options}</select></td>
              <td><input type="number" class="form-control-col rate" min="0" value="0" readonly></td>
              <td><input type="number" class="form-control-col qty" min="1" value="1"></td>
              <td><input type="number" class="form-control-col amount" min="0" value="0" readonly></td>
              <td><input type="text" class="form-control-col remarks" placeholder="Remarks"></td>
              <td><span class="remove-row">✕</span></td>
            </tr>`;
              $("#restaurant_table tbody").append(row);
            };

            $("#add_row_btn").on("click", addRow);
            addRow();

            // remove row
            container.on("click", ".remove-row", function () {
              $(this).closest("tr").remove();
            });

            // auto-calc amount whenever qty changes (rate is fixed)
            container.on("input", ".qty", function () {
              const row = $(this).closest("tr");
              const rate = parseFloat(row.find(".rate").val() || 0);
              const qty = parseFloat(row.find(".qty").val() || 0);
              row.find(".amount").val((rate * qty).toFixed(2));
            });

            // fetch rate from Item Price (price_list_rate)
            container.on("change", ".item_name", function () {
              const item_name = $(this).val();
              const row = $(this).closest("tr");
              const rateInput = row.find(".rate");

              if (item_name) {
                frappe.call({
                  method: "frappe.client.get_value",
                  args: {
                    doctype: "Item Price",
                    filters: { item_code: item_name },
                    fieldname: ["price_list_rate"]
                  },
                  callback: (res) => {
                    const rate = res.message?.price_list_rate || 0;
                    rateInput.val(rate);
                    const qty = parseFloat(row.find(".qty").val() || 1);
                    row.find(".amount").val((rate * qty).toFixed(2));
                  }
                });
              } else {
                rateInput.val("0");
                row.find(".amount").val("0");
              }
            });
          }
        }
      });
    }
    else if (service_type === "Room Service") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_service_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Room Service Items</label>`;
            r.message.forEach((item, idx) => {
              html += `
          <div class="item-row" data-item-index="${idx}">
            <div>
              <input type="checkbox" id="rs_chk_${idx}" name="service_item" value="${item}">
              <label for="rs_chk_${idx}">${item}</label>
            </div>
            <div class="item-controls">
              <input type="number" id="rs_rate_${idx}" class="form-control-col" readonly style="width:80px;" placeholder="Rate">
            </div>
            <div class="item-controls">
              <input type="number" id="rs_qty_${idx}" class="form-control-col" min="1" value="1" style="width:70px;" disabled>
            </div>
            <div>
              <input type="text" id="rs_remark_${idx}" class="form-control-col" placeholder="Remarks" disabled>
            </div>
          </div>`;
            });
            container.html(html);

            r.message.forEach((item, idx) => {
              // fetch price once when rendering
              frappe.call({
                method: "frappe.client.get_value",
                args: {
                  doctype: "Item Price",
                  filters: { item_code: item },
                  fieldname: "price_list_rate"
                },
                callback: (res) => {
                  if (res.message && res.message.price_list_rate) {
                    $(`#rs_rate_${idx}`).val(res.message.price_list_rate);
                  } else {
                    $(`#rs_rate_${idx}`).val("0");
                  }
                }
              });

              // enable/disable controls
              $(`#rs_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#rs_qty_${idx}, #rs_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

      // SPA
    } else if (service_type === "Spa") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_spa_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Spa Services</label>`;
            r.message.forEach((item, idx) => {
              html += `
          <div class="item-row" data-item-index="${idx}">
            <div>
              <input type="checkbox" id="spa_chk_${idx}" name="service_item" value="${item}">
              <label for="spa_chk_${idx}">${item}</label>
            </div>
            <div class="item-controls">
              <input type="number" id="spa_rate_${idx}" class="form-control-col" readonly style="width:80px;" placeholder="Rate">
            </div>
            <div class="item-controls">
              <input type="number" id="spa_qty_${idx}" class="form-control-col" min="1" value="1" style="width:70px;" disabled>
            </div>
            <div>
              <input type="text" id="spa_remark_${idx}" class="form-control-col" placeholder="Remarks" disabled>
            </div>
          </div>`;
            });
            container.html(html);

            r.message.forEach((item, idx) => {
              // fetch price from Item Price
              frappe.call({
                method: "frappe.client.get_value",
                args: {
                  doctype: "Item Price",
                  filters: { item_code: item },
                  fieldname: "price_list_rate"
                },
                callback: (res) => {
                  if (res.message && res.message.price_list_rate) {
                    $(`#spa_rate_${idx}`).val(res.message.price_list_rate);
                  } else {
                    $(`#spa_rate_${idx}`).val("0");
                  }
                }
              });

              $(`#spa_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#spa_qty_${idx}, #spa_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

      // LAUNDRY
    } else if (service_type === "Laundry") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_laundry_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Laundry Services</label>`;
            r.message.forEach((item, idx) => {
              html += `
          <div class="item-row" data-item-index="${idx}">
            <div>
              <input type="checkbox" id="laundry_chk_${idx}" name="service_item" value="${item}">
              <label for="laundry_chk_${idx}">${item}</label>
            </div>
            <div class="item-controls">
              <input type="number" id="laundry_rate_${idx}" class="form-control-col" readonly style="width:80px;" placeholder="Rate">
            </div>
            <div class="item-controls">
              <input type="number" id="laundry_qty_${idx}" class="form-control-col" min="1" value="1" style="width:70px;" disabled>
            </div>
            <div>
              <input type="text" id="laundry_remark_${idx}" class="form-control-col" placeholder="Remarks" disabled>
            </div>
          </div>`;
            });
            container.html(html);

            r.message.forEach((item, idx) => {
              frappe.call({
                method: "frappe.client.get_value",
                args: {
                  doctype: "Item Price",
                  filters: { item_code: item },
                  fieldname: "price_list_rate"
                },
                callback: (res) => {
                  $(`#laundry_rate_${idx}`).val(res.message?.price_list_rate || "0");
                }
              });

              $(`#laundry_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#laundry_qty_${idx}, #laundry_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

      // TRANSPORT
    } else if (service_type === "Transport") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_transport_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Transport Options</label>`;
            r.message.forEach((item, idx) => {
              html += `
          <div class="item-row" data-item-index="${idx}">
            <div>
              <input type="checkbox" id="trans_chk_${idx}" name="service_item" value="${item}">
              <label for="trans_chk_${idx}">${item}</label>
            </div>
            <div class="item-controls">
              <input type="number" id="trans_rate_${idx}" class="form-control-col" readonly style="width:80px;" placeholder="Rate">
            </div>
            <div class="item-controls">
              <input type="number" id="trans_pass_${idx}" class="form-control-col" min="1" value="1" placeholder="Passengers" style="width:80px;" disabled>
            </div>
            <div>
              <input type="text" id="trans_remark_${idx}" class="form-control-col" placeholder="Remarks" disabled>
            </div>
          </div>`;
            });
            container.html(html);

            r.message.forEach((item, idx) => {
              frappe.call({
                method: "frappe.client.get_value",
                args: {
                  doctype: "Item Price",
                  filters: { item_code: item },
                  fieldname: "price_list_rate"
                },
                callback: (res) => {
                  $(`#trans_rate_${idx}`).val(res.message?.price_list_rate || "0");
                }
              });

              $(`#trans_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#trans_pass_${idx}, #trans_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });


    } else if (service_type === "Other") {
      let html = `
        <div class="form-group">
          <label>Describe Service</label>
          <input type="text" id="service_item_other" class="form-control-col" placeholder="Enter service details">
        </div>
      `;
      container.html(html);
    }
  }

  collect_items(service_type) {
    const items = [];

    if (service_type === "Restaurant") {
      $("#restaurant_table tbody tr").each(function () {
        const item_name = $(this).find(".item_name").val();
        const rate = parseFloat($(this).find(".rate").val() || 0);
        const qty = parseInt($(this).find(".qty").val() || 1);
        const remarks = $(this).find(".remarks").val() || "";

        if (item_name) {
          items.push({ item_name, rate, qty, custom_remarks: remarks });
        }
      });
    }

    else if (["Room Service", "Spa", "Laundry", "Transport"].includes(service_type)) {
      $(`input[name='service_item']`).each(function (idx, el) {
        const $el = $(el);
        if ($el.is(":checked")) {
          const id = $el.attr("id");
          const rate = parseFloat($(`#${id.replace('_chk_', '_rate_')}`).val() || 0);
          const qty = parseInt($(`#${id.replace('_chk_', '_qty_')}`).val() || 1);
          const remark = $(`#${id.replace('_chk_', '_remark_')}`).val() || "";
          const passengers = service_type === "Transport" ? parseInt($(`#${id.replace('_chk_', '_pass_')}`).val() || 1) : null;

          items.push({
            item_name: $el.val(),
            rate,
            quantity: qty,
            passengers,
            custom_remarks: remark
          });
        }
      });
    }

    else if (service_type === "Other") {
      const desc = $("#service_item_other").val();
      if (desc) {
        items.push({
          item_name: desc,
          quantity: parseInt($("#quantity_other").val() || 1),
          custom_remarks: $("#custom_remarks_other").val() || ""
        });
      }
    }

    return items;
  }

  submit_order() {
    const data = {
      room_number: $("#room_number").val(),
      guest: $("#guest_name").val(),
      service_type: $("#service_type").val(),
      delivery_to: $("#delivery_to").val(),
    };

    if (!data.room_number) return frappe.msgprint("Please select Room Number.");
    if (!data.guest) return frappe.msgprint("Guest not found for selected room.");
    if (!data.service_type) return frappe.msgprint("Please select Service Type.");

    const collected = this.collect_items(data.service_type);
    if (!collected.length) return frappe.msgprint("Please select at least one service item.");

    data.items = collected;

    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.create_room_order",
      args: { data: JSON.stringify(data) },
      freeze: true,
      freeze_message: __("Creating Room Order..."),
      callback: (r) => {
        if (r.message) {
          frappe.msgprint({
            title: __("Success"),
            message: `<b>Room Order Created</b>`,
            indicator: "green"
          });
          $("#service_type").val("");
          $("#dynamic_input").empty();
        } else {
          frappe.msgprint("Could not create Room Order. Check server logs.");
        }
      }
    });
  }
}
