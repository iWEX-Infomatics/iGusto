let allRooms = [];
let selectedStatuses = [];
let selectedRoomTypes = [];

frappe.pages['room-dashboard'].on_page_load = function(wrapper) {
  let page = frappe.ui.make_app_page({
    parent: wrapper,
    title: 'Room Availability Dashboard',
    single_column: true
  });

  $(frappe.render_template("room_dashboard")).appendTo(page.main);

  // Load rooms
  loadRooms();
  
  // Setup filters
  setupFilters();
  
  // Auto refresh every 30 seconds
  setInterval(() => {
    loadRooms();
  }, 30000);
};

function loadRooms() {
  frappe.call({
    method: "igusto.igusto.page.room_dashboard.room_dashboard.get_rooms",
    callback: function(r) {
      if (!r.message) return;
      allRooms = r.message;
      populateRoomTypeButtons();
      populateStatusButtons();
      applyFilters();
    }
  });
}

function populateRoomTypeButtons() {
  let roomTypes = [...new Set(allRooms.map(r => r.room_type).filter(Boolean))];
  let container = $("#roomtype-buttons");
  
  container.find('.filter-btn:not(.all-btn)').remove();
  
  roomTypes.forEach(type => {
    let btn = $(`<button class="filter-btn roomtype-btn" data-value="${type}">${type}</button>`);
    container.append(btn);
  });
  
  $(".roomtype-btn").on("click", function() {
    toggleRoomTypeFilter($(this));
  });
}

function populateStatusButtons() {
  let statuses = [...new Set(allRooms.map(r => r.status).filter(Boolean))];
  let container = $("#status-buttons");
  
  container.find('.filter-btn:not(.all-btn)').remove();
  
  statuses.forEach(status => {
    let statusLower = status.toLowerCase();
    let btn = $(`<button class="filter-btn status-btn ${statusLower}-btn" data-value="${status}">${status}</button>`);
    container.append(btn);
  });
  
  $(".status-btn").on("click", function() {
    toggleStatusFilter($(this));
  });
}

function setupFilters() {
  $("#roomnumber-filter").on("input", applyFilters);
  $("#clear-filters").on("click", clearFilters);
}

function toggleStatusFilter(btn) {
  let value = btn.data("value");
  
  if (value === "all") {
    selectedStatuses = [];
    $(".status-btn").removeClass("active");
    btn.addClass("active");
  } else {
    $(".status-btn[data-value='all']").removeClass("active");
    btn.toggleClass("active");
    
    if (btn.hasClass("active")) {
      if (!selectedStatuses.includes(value)) {
        selectedStatuses.push(value);
      }
    } else {
      selectedStatuses = selectedStatuses.filter(s => s !== value);
    }
    
    if (selectedStatuses.length === 0) {
      $(".status-btn[data-value='all']").addClass("active");
    }
  }
  
  applyFilters();
}

function toggleRoomTypeFilter(btn) {
  let value = btn.data("value");
  
  if (value === "all") {
    selectedRoomTypes = [];
    $(".roomtype-btn").removeClass("active");
    btn.addClass("active");
  } else {
    $(".roomtype-btn[data-value='all']").removeClass("active");
    btn.toggleClass("active");
    
    if (btn.hasClass("active")) {
      if (!selectedRoomTypes.includes(value)) {
        selectedRoomTypes.push(value);
      }
    } else {
      selectedRoomTypes = selectedRoomTypes.filter(t => t !== value);
    }
    
    if (selectedRoomTypes.length === 0) {
      $(".roomtype-btn[data-value='all']").addClass("active");
    }
  }
  
  applyFilters();
}

function applyFilters() {
  let roomNumberFilter = $("#roomnumber-filter").val().toLowerCase().trim();
  
  let filtered = allRooms.filter(room => {
    let matchStatus = selectedStatuses.length === 0 || 
                     selectedStatuses.some(s => s.toLowerCase() === (room.status || "").toLowerCase());
    
    let matchRoomType = selectedRoomTypes.length === 0 || 
                       selectedRoomTypes.includes(room.room_type);
    
    let matchRoomNumber = !roomNumberFilter || 
                         (room.room_number || "").toLowerCase().includes(roomNumberFilter);
    
    return matchStatus && matchRoomType && matchRoomNumber;
  });
  
  render_rooms(filtered);
  updateStats(filtered.length);
}

function clearFilters() {
  selectedStatuses = [];
  $(".status-btn").removeClass("active");
  $(".status-btn[data-value='all']").addClass("active");
  
  selectedRoomTypes = [];
  $(".roomtype-btn").removeClass("active");
  $(".roomtype-btn[data-value='all']").addClass("active");
  
  $("#roomnumber-filter").val("");
  
  applyFilters();
}

function updateStats(filteredCount) {
  $("#total-rooms").text(allRooms.length);
  $("#filtered-rooms").text(filteredCount);
}

function render_rooms(rooms) {
  let grid = $("#room-grid");
  grid.empty();

  if (rooms.length === 0) {
    grid.append('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#666;">No rooms found matching filters</div>');
    return;
  }

  rooms.forEach(room => {
    let status = room.status ? room.status : "NA";
    let status_class = room.status ? room.status.toLowerCase() : "na";
    let status_icon = getStatusIcon(status);
    
    // Create card with progress indicator for occupied/booked rooms
    let cardHTML = '';
    
    if ((status === 'Occupied' || status === 'Booked') && room.booking_progress !== null) {
      // Card with progress indicator - no status display for occupied
      let progress = room.booking_progress;
      let completedColor = '#22c55e'; // Green
      let remainingColor = '#0891b2'; // Darker cyan for remaining days
      
      if (status === 'Occupied') {
        // For occupied - show only progress bar, no status
        cardHTML = `
          <div class="room-card ${status_class}" style="cursor:pointer">
            <div class="room-no">#${room.room_number}: ${room.room_type || ""}</div>
            <div class="room-progress-bar" style="
              position: relative;
              margin-top: 12px;
              height: 32px;
              border-radius: 16px;
              overflow: hidden;
              display: flex;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
            ">
              <div style="
                width: ${progress}%;
                background: ${completedColor};
                transition: width 0.3s ease;
              "></div>
              <div style="
                flex: 1;
                background: ${remainingColor};
              "></div>
              <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 13px;
                font-weight: 700;
                text-shadow: 0 1px 3px rgba(0,0,0,0.5);
              ">
                Day ${room.days_completed} of ${room.total_days}
              </div>
            </div>
          </div>
        `;
      } else {
        // For booked - show status and progress bar
        cardHTML = `
          <div class="room-card ${status_class}" style="cursor:pointer">
            <div class="room-no">#${room.room_number}: ${room.room_type || ""}</div>
            <div class="room-status">
              <span class="room-status-icon">${status_icon}</span>
              ${status}
            </div>
            <div class="room-progress-bar" style="
              position: relative;
              margin-top: 8px;
              height: 28px;
              border-radius: 14px;
              overflow: hidden;
              display: flex;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
            ">
              <div style="
                width: ${progress}%;
                background: ${completedColor};
                transition: width 0.3s ease;
              "></div>
              <div style="
                flex: 1;
                background: ${remainingColor};
              "></div>
              <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                font-weight: 700;
                text-shadow: 0 1px 3px rgba(0,0,0,0.5);
              ">
                Day ${room.days_completed} of ${room.total_days}
              </div>
            </div>
          </div>
        `;
      }
    } else {
      // Regular card without progress
      cardHTML = `
        <div class="room-card ${status_class}" style="cursor:pointer">
          <div class="room-no">#${room.room_number} : ${room.room_type || ""}</div>
          <div class="room-status">
            <span class="room-status-icon">${status_icon}</span>
            ${status}
          </div>
        </div>
      `;
    }
    
    let card = $(cardHTML);

    card.on("click", function () {
      open_room_popup(room);
    });

    grid.append(card);
  });
}

function getStatusIcon(status) {
  const icons = {
    'Vacant': '✓',
    'Available': '✓',
    'Booked': '📅',
    'Occupied': '🔒',
    'Dirty': '🧹',
    'Clean': '✨',
    'Maintenance': '🔧',
    'Blocked': '⛔',
    'na': '❓'
  };
  
  return icons[status] || '❓';
}

function open_room_popup(room) {
  let dialog = new frappe.ui.Dialog({
    title: `Room ${room.room_number} Details`,
    fields: [
      {
        fieldtype: "Data",
        label: "Room Number",
        fieldname: "room_number",
        read_only: 1
      },
      {
        fieldtype: "Data",
        label: "Room Type",
        fieldname: "room_type",
        read_only: 1
      },
      {
        fieldtype: "Data",
        label: "Status",
        fieldname: "status",
        read_only: 1
      },
      {
        fieldtype: "Section Break"
      },
      {
        fieldtype: "Data",
        label: "Current Guest",
        fieldname: "current_guest",
        read_only: 1
      },
      {
        fieldtype: "Data",
        label: "Current Booking",
        fieldname: "current_booking",
        read_only: 1
      }
    ],
    primary_action_label: "Open Room",
    primary_action() {
      frappe.set_route("Form", "Room", room.name);
      dialog.hide();
    }
  });

  let dialogValues = {
    room_number: room.room_number,
    room_type: room.room_type,
    status: room.status || "NA",
    current_guest: room.current_guest || "NA",
    current_booking: room.current_booking || "NA",
    housekeeping_status: room.housekeeping_status || "NA"
  };
  
  // Add booking dates if available
  if (room.from_date && room.to_date) {
    dialog.fields_dict.status.df.description = 
      `Booking: ${room.from_date} to ${room.to_date} (Day ${room.days_completed}/${room.total_days})`;
    dialog.refresh();
  }

  dialog.set_values(dialogValues);
  dialog.show();
}