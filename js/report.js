window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  const mainContent = document.getElementById('main-content');

  setTimeout(() => {
    preloader.style.display = 'none';
    mainContent.style.display = 'block';
  }, 2000);
});

const SPREADSHEET_ID = "1fbiqeuKFJHd0xR2qI2HixXGYCgwN1suxMI2BXrH4uNg";
const API_KEY = "AIzaSyC-7jwS9MVNWppcrztoXuVr9ZTIfFSvH1M";
const SHEET_NAME = "ONBOARD_WEIGHING_SCALE";
const range = '!O2:S'; 

function goBack() {
    window.history.back();
}

async function fetchData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  const rows = data.values;
  const dates = rows.map(row => row[0]);
  const weights = rows.map(row => parseFloat(row[4]));

  return { rows, dates, weights };
}

async function renderChart() {
  const { dates, weights } = await fetchData();

  const MAX_WEIGHT = 50000000;
  let maxCount = 0;

  const filteredWeights = weights.map(weight => {
    if (weight >= MAX_WEIGHT) {
      maxCount++;
      return MAX_WEIGHT;
    }
    return weight;
  });

  document.querySelector(".countReachedMax").innerHTML = maxCount;

  console.log(`The graph reached the maximum value (${MAX_WEIGHT} kg) or above ${maxCount} times.`);

  const ctx = document.getElementById('weightChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Total Weight (kg)',
        data: filteredWeights,
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
            text: 'Total Weight (kg)'
          },
          max: MAX_WEIGHT 
        }
      }
    }
  });
}

renderChart();


  function formatDate(dateString) {
    //console.log(dateString);
    const [day, month, year] = dateString.split('/').map(Number);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[month - 1]} ${day}, ${year}`;
  }

  async function downloadExcel() {
    const { rows } = await fetchData();
  
    // Create a workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
  
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
    // Generate binary string and convert to Blob
    const binaryData = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "binary"
    });
  
    // Convert binary string to an array buffer
    const buffer = new ArrayBuffer(binaryData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binaryData.length; i++) {
      view[i] = binaryData.charCodeAt(i) & 0xFF;
    }
  
    // Create a Blob and download the file
    const excelBlob = new Blob([buffer], { type: "application/octet-stream" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(excelBlob);
    link.download = "data.xlsx";
    link.click();
  }
  