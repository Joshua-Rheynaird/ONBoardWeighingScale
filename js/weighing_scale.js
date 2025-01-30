import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvdzjuvyewgunhwpmlnu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZHpqdXZ5ZXdndW5od3BtbG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNDQ3MTAsImV4cCI6MjA1MzcyMDcxMH0.hAohKOlZ3PguyYZeVDA1ngHUYWdqYXg0S2WJ-I2lCHA";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const REFRESH_INTERVAL = 3600000; // 1 hour in milliseconds

let chart = null; // Track the existing chart instance

async function renderChart() {
  const data = await fetchTruckTrips();
  if (!data || data.length === 0) return;

  const tripDates = data.map(item => item.trip_date);
  const avgWeights = data.map(item => item.avg_weight);

  const MAX_WEIGHT = 50000000;
  let maxCount = 0;

  // Accumulate the weights to create a cumulative total
  let cumulativeWeights = [];
  let cumulativeTotal = 0;

  avgWeights.forEach(weight => {
    cumulativeTotal += weight;
    cumulativeWeights.push(cumulativeTotal);
    
    if (cumulativeTotal >= MAX_WEIGHT) {
      maxCount++;
      cumulativeTotal = MAX_WEIGHT; // Limit the value to MAX_WEIGHT
    }
  });

  //document.querySelector(".countReachedMax").innerHTML = maxCount;

  //console.log(`The graph reached the maximum value (${MAX_WEIGHT} kg) or above ${maxCount} times.`);

  const ctx = document.getElementById('weightChart').getContext('2d');

  // Destroy the existing chart instance if it exists
  if (chart) {
    chart.destroy();
  }

  // Create a new chart
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: tripDates, // Use actual trip dates here
      datasets: [{
        label: 'Cumulative Total Weight (kg)',
        data: cumulativeWeights, // Use accumulated weight data
        borderColor: '#e6e6e6',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Cumulative Total Weight (kg)'
          },
          max: 100000, // Cap the y-axis to a max value for display purposes
          ticks: {
            // Optionally, set the tick step size for better visual scaling
            stepSize: Math.ceil(MAX_WEIGHT / 5), // Divide the max weight into manageable steps
            callback: function(value) {
              // Display values in readable format
              return value.toLocaleString();
            }
          }
        }
      }
    }
  });
}

// Fetch truck trips data
async function fetchTruckTrips() {
  const { data, error } = await supabase.rpc('get_truck_trips_avg_weight');

  if (error) {
    console.error("Error fetching truck trips data:", error);
    return [];
  }

  return data;
}

// Initialize the app
function initializeApp() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'record-section' || hash === 'logger-section' || hash === 'report-section') {
    showSection(hash);
  } else {
    showSection('record-section');
  }
}

// Show a section and update history
window.showSection = function (sectionId) {
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');

  // Show/hide buttons based on active section
  if (sectionId === 'record-section') {
    document.getElementById('record-button').classList.add('hidden');
    document.getElementById('logger-button').classList.remove('hidden');
    document.getElementById('report-button').classList.remove('hidden');
  } else if (sectionId === 'logger-section') {
    document.getElementById('logger-button').classList.add('hidden');
    document.getElementById('record-button').classList.remove('hidden');
    document.getElementById('report-button').classList.remove('hidden');
  } else if (sectionId === 'report-section') {
    document.getElementById('record-button').classList.remove('hidden');
    document.getElementById('logger-button').classList.remove('hidden');
    document.getElementById('report-button').classList.add('hidden');
  }

  history.pushState({ section: sectionId }, '', `#${sectionId}`);
};

// Handle back button
window.addEventListener('popstate', (event) => {
  const state = event.state;
  if (state && state.section) {
    showSection(state.section);
  } else {
    showSection('record-section');
  }
});

// Initialize the app when the page loads
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  const mainContent = document.getElementById('main-content');

  setTimeout(() => {
    preloader.style.display = 'none';
    mainContent.style.display = 'block';
  }, 2000);

  initializeApp();
});


// Handle back button
window.addEventListener('popstate', (event) => {
  const state = event.state;
  if (state && state.section) {
    showSection(state.section);
  } else {
    showSection('record-section');
  }
});

// Initialize the app when the page loads
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  const mainContent = document.getElementById('main-content');

  setTimeout(() => {
    preloader.style.display = 'none';
    mainContent.style.display = 'block';
  }, 2000);

  initializeApp();
  fetchData();
});

// Fetch and display data
window.fetchData = async function () {
  const selectedFilter = document.getElementById("selectedFilter").textContent.toLowerCase();
  const colorFilter = selectedFilter === "all" ? "" : selectedFilter;

  let { data, error } = await supabase
    .from("loading")
    .select("id, created_at, weight, grade, shift, truck_id, sensor_status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  if (colorFilter) {
    data = data.filter(row => row.grade && row.grade.toLowerCase() === colorFilter);
  }

  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = "";

  data.forEach(row => {
    const date = new Date(row.created_at);
    const formattedDate = date.toISOString().split("T")[0];
    const formattedTime = date.toTimeString().split(" ")[0];

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(formattedDate)}</td>
      <td>${formatTime(formattedTime)}</td>
      <td>${row.truck_id || "N/A"}</td>
      <td>${row.shift}</td>
      <td>${row.sensor_status}</td>
      <td>${row.weight.toFixed(2)} kg</td>
      <td>
        <div class="color-picker">
          <div class="selected-color" style="background-color: ${row.grade};" onclick="toggleDropdown('${row.id}')"></div>
          <div class="color-options" id="color-options-${row.id}">
            <div class="color-option" style="background-color: red;" onclick="selectColor('${row.id}', 'red')"></div>
            <div class="color-option" style="background-color: blue;" onclick="selectColor('${row.id}', 'blue')"></div>
            <div class="color-option" style="background-color: yellow;" onclick="selectColor('${row.id}', 'yellow')"></div>
            <div class="color-option" style="background-color: black;" onclick="selectColor('${row.id}', 'black')"></div>
            <div class="color-option" style="background-color: white;" onclick="selectColor('${row.id}', 'white')"></div>
            <div class="color-option" style="background-color: green;" onclick="selectColor('${row.id}', 'green')"></div>
          </div>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  const truckTripsData = await fetchTruckTrips();

  if (data.length > 0) {
    const mostRecent = data[0];
    const date = new Date(mostRecent.created_at);
    const formattedDate = date.toISOString().split("T")[0];
    const formattedTime = date.toTimeString().split(" ")[0];

    const truckTrips = truckTripsData.find(truck => truck.truck_id === mostRecent.truck_id);

    document.querySelector(".date-val").textContent = formatDate(formattedDate);
    document.querySelector(".time-val").textContent = formatTime(formattedTime);
    document.querySelector(".stats-val").textContent = `${mostRecent.sensor_status}`;
    document.querySelector(".load-val").textContent = `${mostRecent.weight.toFixed(2)} kg`;
    document.querySelector(".trips-val").textContent = truckTrips ? truckTrips.total_trips : "N/A";
    document.querySelector(".total-val").textContent = `${data.reduce((sum, row) => sum + row.weight, 0).toFixed(2)} kg`;
  }

  renderChart(); // Render the chart after data is fetched
};

// Update grade in the database
window.updateGrade = async function (id, color) {
  const { error } = await supabase
    .from("loading")
    .update({ grade: color })
    .eq("id", id);

  if (error) {
    console.error("Error updating grade:", error);
    alert("Failed to update grade.");
  } else {
    console.log("Grade updated successfully.");
    fetchData();
  }
};

// Toggle color dropdown
window.toggleDropdown = function (id) {
  const dropdown = document.getElementById(`color-options-${id}`);
  dropdown.classList.toggle("active");
};

// Select color and update grade
window.selectColor = function (id, color) {
  const selectedColor = document.querySelector(`#color-options-${id}`).previousElementSibling;
  selectedColor.style.backgroundColor = color;

  toggleDropdown(id);
  updateGrade(id, color);
};

// Toggle filter dropdown
window.toggleFilterDropdown = function () {
  const dropdownOptions = document.getElementById("filterOptions");
  dropdownOptions.classList.toggle("active");
};

// Select filter and fetch data
window.selectFilter = function (value) {
  const selectedFilter = document.getElementById("selectedFilter");
  selectedFilter.textContent = value === "all" ? "All" : value;

  toggleFilterDropdown();
  fetchData();
};

// Format date
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

// Format time
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Auto-refresh every hour
async function delayedTask(ms) {
  await new Promise((resolve) => setTimeout(() => resolve(), ms));
  console.log("Restarting every: " + ms);
  fetchData();
}

delayedTask(REFRESH_INTERVAL);
