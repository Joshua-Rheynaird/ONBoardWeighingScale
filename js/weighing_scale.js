import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =================== CONSTANTS & GLOBAL VARIABLES ===================
const SUPABASE_URL = "https://rvdzjuvyewgunhwpmlnu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZHpqdXZ5ZXdndW5od3BtbG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNDQ3MTAsImV4cCI6MjA1MzcyMDcxMH0.hAohKOlZ3PguyYZeVDA1ngHUYWdqYXg0S2WJ-I2lCHA";
const REFRESH_INTERVAL = 3600000; // 1 hour in milliseconds
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let chart = null; 
let driverName = ""; 
let dtNo = "";
let modal = document.getElementById("confirmationModal");


// =================== UTILITY FUNCTIONS ===================
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatNumber(num) {
  return Number(num).toLocaleString(); // Format number with commas
}

function downloadFile(url, filename = "downloaded_file") {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =================== DATA FUNCTIONS ===================
async function fetchAdminPassword() {
  try {
    const { data, error } = await supabase
      .from('barges')
      .select('password')
      .single();

    if (error) {
      console.error('Error fetching admin password:', error);
      return null;
    }

    // Check if password is in JSONB format and extract admin password
    if (data && data.password && data.password.default) {
      return data.password.default;
    } else {
      console.warn('Admin password not found in expected format');
      return null;
    }
  } catch (err) {
    console.error('Error in fetchAdminPassword:', err);
    return null;
  }
}

async function fetchBargeLimit() {
  const { data, error } = await supabase
    .from('barges')
    .select('limit')
    .single();

  if (error) {
    console.error('Error fetching barge limit:', error);
    return 100000; // Default max value if fetching fails
  }

  return data.limit;
}

async function fetchTruckTrips() {
  const { data, error } = await supabase.rpc('get_truck_trips_avg_weight');

  if (error) {
    console.error("Error fetching truck trips data:", error);
    return [];
  }

  return data;
}

async function fetchBarge() {
  const { data, error } = await supabase
    .from('barges')
    .select('limit')
    .single();

  if (error) {
    console.error('Error fetching data:', error);
    document.getElementById('bargeLimit').value = "Error loading data";
    return;
  }

  document.getElementById('bargeLimit').value = formatNumber(data.limit);
}

async function updateBarge() {
  const bargeLimitEl = document.getElementById('bargeLimit');
  const newLimit = bargeLimitEl.value.replace(/,/g, ''); // Remove commas

  if (newLimit === "" || isNaN(newLimit)) {
    alert("Please enter a valid number.");
    return;
  }

  const { error } = await supabase
    .from('barges')
    .update({ limit: Number(newLimit) })
    .match({ id: 1 });

  if (error) {
    console.error('Error updating data:', error);
    alert('Failed to update limit.');
  } else {
    alert('Barge limit updated successfully!');
    bargeLimitEl.value = formatNumber(newLimit);
    location.reload();
  }
}

async function fetchData() {
  let { data, error } = await supabase
    .from("loading")
    .select("id, created_at, weight, grade, shift, truck_id, sensor_status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  updateTableData(data);
  
  const truckTripsData = await fetchTruckTrips();
  const totalAvgWeight = truckTripsData.reduce((sum, item) => sum + item.avg_weight, 0);

  updateDashboardStats(data, truckTripsData, totalAvgWeight);
  
  renderChart(); // Render the chart after data is fetched
}

function updateTableData(data) {
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
}

function updateDashboardStats(data, truckTripsData, totalAvgWeight) {
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
    document.querySelector(".trips-val").textContent = truckTripsData ? truckTripsData.length : "N/A";
    document.querySelector(".total-val").textContent = `${totalAvgWeight.toFixed(2)} kg`;
  }
}

async function updateGrade(id, color) {
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

// =================== UI FUNCTIONS ===================
async function renderChart() {
  const data = await fetchTruckTrips();
  if (!data || data.length === 0) return;

  const bargeLimit = await fetchBargeLimit();

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
      cumulativeTotal = bargeLimit;
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
      labels: tripDates.map(date => new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })),
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
          },
          ticks: {
            callback: function(value, index, values) {
              const date = new Date(tripDates[index]);
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
            }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Cumulative Total Weight (kg)'
          },
          max: bargeLimit,
          ticks: {
            stepSize: Math.ceil(bargeLimit / 5),
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      }
    }
  });
}

function showSection(sectionId) {
  document.querySelectorAll("section").forEach((section) => {
    section.classList.add("hidden");
  });

  const targetSection = document.getElementById(sectionId);
  targetSection.classList.remove("hidden");

  // Trigger fade-in effect
  setTimeout(() => {
    targetSection.classList.add("fade-in");
  }, 10);

  // Update active buttons
  const buttons = {
    "record-section": document.getElementById("record-button"),
    "logger-section": document.getElementById("logger-button"),
    "report-section": document.getElementById("report-button")
  };
  
  Object.keys(buttons).forEach(section => {
    if (section === sectionId) {
      buttons[section].classList.add("active");
    } else {
      buttons[section].classList.remove("active");
    }
  });

  if (sectionId !== "report-section") {
    fetchData();
  }

  history.pushState({ section: sectionId }, "", `#${sectionId}`);
}

function initializeApp() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'record-section' || hash === 'logger-section' || hash === 'report-section') {
    showSection(hash);
  } else {
    showSection('record-section');
  }
}

function refreshPage(element) {
  element.classList.add("spin");
  setTimeout(() => {
    element.classList.remove("spin");
    location.reload();
  }, 500);
}

async function delayedTask(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  console.log("Restarting every: " + ms);
  fetchData();
  location.reload();
}

// =================== MODAL FUNCTIONS ===================
function openModal() {
  // Clear any previous error messages
  const errorElement = document.getElementById('password-error');
  if (errorElement) {
    errorElement.textContent = '';
  }
  
  // Clear any previous password input
  const passwordInput = document.getElementById('admin-password');
  if (passwordInput) {
    passwordInput.value = '';
  }
  
  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
}

function openTruckModal() {
  document.getElementById('truckModal').style.display = 'block';
}

function closeTruckModal() {
  document.getElementById('truckModal').style.display = 'none';
}

async function confirmDeletion() {
  const passwordInput = document.getElementById('admin-password');
  const errorElement = document.getElementById('password-error');
  
  if (!passwordInput || !passwordInput.value) {
    errorElement.textContent = "Password is required";
    return;
  }
  
  // Show loading state
  errorElement.textContent = "Verifying...";
  
  // Fetch the admin password from the database
  const adminPassword = await fetchAdminPassword();
  
  if (!adminPassword) {
    errorElement.textContent = "Could not validate password. Please try again later.";
    return;
  }
  
  if (passwordInput.value !== adminPassword) {
    errorElement.textContent = "Incorrect password";
    passwordInput.value = '';
    return;
  }

  // Password is correct, proceed with deletion
  errorElement.textContent = "Password correct. Deleting data...";
  
  const { data, error } = await supabase.rpc('truncate_loading_table');

  if (error) {
    console.error('Error truncating loading table:', error);
    alert('Failed to truncate the loading table.');
  } else {
    alert('The loading table has been truncated successfully.');
    fetchData();
    location.reload();
  }
  closeModal();
}

function toggleDropdown(id) {
  const dropdown = document.getElementById(`color-options-${id}`);
  dropdown.classList.toggle("active");
}

function selectColor(id, color) {
  const selectedColor = document.querySelector(`#color-options-${id}`).previousElementSibling;
  selectedColor.style.backgroundColor = color;

  toggleDropdown(id);
  updateGrade(id, color);
}

// =================== EVENT LISTENERS ===================
window.addEventListener("load", () => {
  // Hide preloader and show the user form
  const preloader = document.getElementById("preloader");
  const userModal = document.getElementById("userInfoModal");
  const mainContent = document.getElementById('main-content');

  setTimeout(() => {
    preloader.style.display = "none";
    userModal.style.display = "flex";
    mainContent.style.display = 'block';
  }, 1000);

  // Initialize confirmation modal
  modal = document.getElementById("confirmationModal");

  initializeApp();
  fetchData();
  fetchBarge();
  
  // Start auto-refresh
  delayedTask(REFRESH_INTERVAL);
});

document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("userName").value.trim();
  const dt = document.getElementById("dtNumber").value.trim();

  if (name && dt) {
    driverName = name; 
    dtNo = dt;
    document.getElementById("greeting").innerText = `Driver: ${name}\n DT Number: ${dt}`;
    document.getElementById("greeting").classList.remove("hidden");
    document.getElementById("userInfoModal").style.display = "none";
  }
});
document.getElementById("downloadChart").addEventListener("click", async function () {
  try {
    // Fetch truck trips data for the chart
    const truckTripsData = await fetchTruckTrips();
    
    if (!truckTripsData || truckTripsData.length === 0) {
      alert("No data found for chart export.");
      return;
    }
    
    // Fetch loading data to get the grade colors
    const { data: loadingData, error } = await supabase
      .from('loading')
      .select('created_at, truck_id, weight, grade, shift')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Create a mapping of truck_id and date to grade color
    const gradeMapping = {};
    loadingData.forEach(load => {
      const date = new Date(load.created_at).toISOString().split('T')[0];
      const key = `${load.truck_id}-${date}`;
      gradeMapping[key] = load.grade;
    });

    // Format the data for Excel export
    const formattedData = truckTripsData.map(trip => {
      const tripDate = new Date(trip.trip_date);
      const date = tripDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Look up the grade color for this truck trip
      const gradeKey = `${trip.truck_id}-${date}`;
      const gradeColor = gradeMapping[gradeKey] || "N/A";
      
      return {
        date: formatDate(date),
        Shift: loadingData.shift,
        average_weight: trip.avg_weight.toFixed(2) + " kg",
        grade: gradeColor, // Color representing grade
        Scope: "BARGING",
        Source_Destination: "SY2-BARGE"
        
      };
    });

    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    
    // Convert array of objects to worksheet
    const ws = XLSX.utils.json_to_sheet(formattedData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Trip Weight Data");
    
    // Generate Excel file as ArrayBuffer
    const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    // Option 1: Direct download in browser
    if (typeof AndroidInterface === 'undefined') {
      // Create a blob from the array buffer
      const blob = new Blob([fileData], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      
      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barge_weight_data_${driverName || "Driver"}_${dtNo || "DT Number"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } 
    // Option 2: Upload to Supabase and download (for Android interface)
    else {
      await uploadFile(fileData);
    }

  } catch (err) {
    console.error("Error downloading chart data:", err.message);
    alert("Error downloading chart data. Check console for details.");
  }
});

document.getElementById('bargeLimit').addEventListener('input', function () {
  let value = this.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters
  if (value) {
    this.value = formatNumber(value); // Format number
  }
});

document.querySelector('.save-btn').addEventListener('click', updateBarge);

window.addEventListener('popstate', (event) => {
  const state = event.state;
  if (state && state.section) {
    showSection(state.section);
  } else {
    showSection('record-section');
  }
});

// =================== EXPORT TO WINDOW OBJECT ===================
// Export functions to window object for HTML access
window.openModal = openModal;
window.closeModal = closeModal;
window.openTruckModal = openTruckModal;
window.closeTruckModal = closeTruckModal;
window.confirmDeletion = confirmDeletion;
window.fetchData = fetchData;
window.updateGrade = updateGrade;
window.toggleDropdown = toggleDropdown;
window.selectColor = selectColor;
window.showSection = showSection;
window.refreshPage = refreshPage;