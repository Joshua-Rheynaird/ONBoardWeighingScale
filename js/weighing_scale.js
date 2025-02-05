import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvdzjuvyewgunhwpmlnu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZHpqdXZ5ZXdndW5od3BtbG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNDQ3MTAsImV4cCI6MjA1MzcyMDcxMH0.hAohKOlZ3PguyYZeVDA1ngHUYWdqYXg0S2WJ-I2lCHA";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const REFRESH_INTERVAL = 3600000; // 1 hour in milliseconds
let chart = null; // Track the existing chart instance

async function fetchBargeLimit() {
    const { data, error } = await supabase
        .from('barges')
        .select('limit')
        .single(); // Fetch only one row

    if (error) {
        console.error('Error fetching barge limit:', error);
        return 100000; // Default max value if fetching fails
    }

    return data.limit;
}

async function renderChart() {
    const data = await fetchTruckTrips();
    if (!data || data.length === 0) return;

    const bargeLimit = await fetchBargeLimit(); // Get barge limit from Supabase

    const tripDates = data.map(item => item.trip_date);
    const avgWeights = data.map(item => item.avg_weight);

    let maxCount = 0;
    let cumulativeWeights = [];
    let cumulativeTotal = 0;

    avgWeights.forEach(weight => {
        cumulativeTotal += weight;
        cumulativeWeights.push(cumulativeTotal);

        if (cumulativeTotal >= bargeLimit) {
            maxCount++;
            cumulativeTotal = bargeLimit; // Limit the value to bargeLimit
        }
    });

    const ctx = document.getElementById('weightChart').getContext('2d');

    if (chart) {
        chart.destroy(); // Destroy the existing chart instance
    }

    // Create a new chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tripDates,
            datasets: [{
                label: 'Cumulative Total Weight (kg)',
                data: cumulativeWeights,
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
                    max: bargeLimit, // Dynamically set max to barge limit
                    ticks: {
                        stepSize: Math.ceil(bargeLimit / 5), // Adjust tick spacing
                        callback: function(value) {
                            return value.toLocaleString(); // Format numbers with commas
                        }
                    }
                }
            }
        }
    });

    fetchTruckTrips();

    document.getElementById("downloadChart").addEventListener("click", function () {
      const wb = XLSX.utils.book_new(); // Create a new workbook
      const ws = XLSX.utils.aoa_to_sheet([
          ["Date", "Average Weight (kg)"], // Header row
          ...tripDates.map((date, index) => [date, avgWeights[index]]) // Data rows
      ]);

      XLSX.utils.book_append_sheet(wb, ws, "Chart Data"); // Append the sheet to the workbook

      // Convert the Excel workbook to a binary string (ArrayBuffer)
      const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      // Upload the file to Supabase Storage
      uploadFile(fileData);

  });
}
async function uploadFile(fileData) {
  const supabaseBucket = 'reports';
  const fileName = 'Barge_report.xlsx';
  const filePath = `${fileName}`;

  try {
    // Convert the fileData ArrayBuffer to a Blob
    const blob = new Blob([fileData], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    // Step 1: Upload the file (upserts if exists)
    const { data, error: uploadError } = await supabase
      .storage
      .from(supabaseBucket)
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: true // Replaces the file if it exists
      });

    if (uploadError) throw uploadError;

    console.log("File uploaded successfully.");

    // Step 2: Get the new public URL
    const { data: urlData } = await supabase
      .storage
      .from(supabaseBucket)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    console.log("New file URL:", publicUrl);

    // Step 3: Trigger the download
    if (typeof AndroidInterface !== 'undefined') {
      AndroidInterface.onDownloadClick(publicUrl);
    } else {
      downloadFile(publicUrl, fileName);
    }
  } catch (err) {
    console.error("Error in upload process:", err);
    alert("Failed to upload report.");
  }
}

function downloadFile(url, filename = "downloaded_file") {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename; // This suggests a filename for the downloaded file
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

let modal = document.getElementById("confirmationModal");

window.openModal = function() {
  modal.style.display = "flex"; // Show the modal
}

window.closeModal = function() {
  modal.style.display = "none"; // Hide the modal
}

window.confirmDeletion = async function() {
  const { data, error } = await supabase.rpc('truncate_loading_table');

  if (error) {
    console.error('Error truncating loading table:', error);
    alert('Failed to truncate the loading table.');
  } else {
    alert('The loading table has been truncated successfully.');
    fetchData(); // Refresh data after truncation
    location.reload();
  }
  closeModal();
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
// Show a section with smooth transition and update history
window.showSection = function (sectionId) {
  document.querySelectorAll("section").forEach((section) => {
    section.classList.add("hidden"); // Hide all sections
  });

  const targetSection = document.getElementById(sectionId);
  targetSection.classList.remove("hidden"); // Show selected section

  // Trigger fade-in effect
  setTimeout(() => {
    targetSection.classList.add("fade-in");
  }, 10);

  // Show/hide buttons based on active section
  if (sectionId === "record-section") {
    document.getElementById("record-button").classList.add("hidden");
    document.getElementById("logger-button").classList.remove("hidden");
    document.getElementById("report-button").classList.remove("hidden");
    fetchData();
  } else if (sectionId === "logger-section") {
    document.getElementById("logger-button").classList.add("hidden");
    document.getElementById("record-button").classList.remove("hidden");
    document.getElementById("report-button").classList.remove("hidden");
    fetchData();
  } else if (sectionId === "report-section") {
    document.getElementById("record-button").classList.remove("hidden");
    document.getElementById("logger-button").classList.remove("hidden");
    document.getElementById("report-button").classList.add("hidden");
  }

  history.pushState({ section: sectionId }, "", `#${sectionId}`);
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
  }, 1000);

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

  let { data, error } = await supabase
    .from("loading")
    .select("id, created_at, weight, grade, shift, truck_id, sensor_status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data:", error);
    return;
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

async function fetchBarge() {
  const { data, error } = await supabase
      .from('barges')
      .select('limit')
      .single(); // Fetch one row only

  if (error) {
      console.error('Error fetching data:', error);
      document.getElementById('bargeLimit').value = "Error loading data";
      return;
  }

  document.getElementById('bargeLimit').value = formatNumber(data.limit);
}
fetchBarge();

async function updateBarge() {
  const bargeLimitEl = document.getElementById('bargeLimit');
  const newLimit = bargeLimitEl.value.replace(/,/g, ''); // Remove commas

  if (newLimit === "" || isNaN(newLimit)) {
      alert("Please enter a valid number.");
      return;
  }

  const { error } = await supabase
      .from('barges')
      .update({ limit: Number(newLimit) }) // Convert to number before saving
      .match({ id: 1 }); // Change '1' to the actual row ID

  if (error) {
      console.error('Error updating data:', error);
      alert('Failed to update limit.');
  } else {
      alert('Barge limit updated successfully!');
      bargeLimitEl.value = formatNumber(newLimit); // Reformat after saving
      location.reload();
  }
}

// Function to format numbers with commas
function formatNumber(num) {
  return Number(num).toLocaleString(); // Format number with commas
}

// Restrict input to numbers only and auto-format
document.getElementById('bargeLimit').addEventListener('input', function () {
  let value = this.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters
  if (value) {
      this.value = formatNumber(value); // Format number
  }
});


document.querySelector('.save-btn').addEventListener('click', updateBarge);

window.refreshPage  = function (element) {
  // Add the spin animation class
  element.classList.add("spin");

  // Remove animation class after the animation completes
  setTimeout(() => {
      element.classList.remove("spin");
      location.reload(); // Refresh the page
  }, 500); // Same duration as animation
}


// Auto-refresh every hour
async function delayedTask(ms) {
  await new Promise((resolve) => setTimeout(() => resolve(), ms));
  console.log("Restarting every: " + ms);
  fetchData();
  location.reload();
}

delayedTask(REFRESH_INTERVAL);
