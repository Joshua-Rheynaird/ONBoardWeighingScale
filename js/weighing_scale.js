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
//const CLIENT_ID ="1001354670869-6u2veq10hlbo5bmhv74c4q1ibp3ob7ru.apps.googleusercontent.com"//web
//const CLIENT_ID ="1001354670869-k62gioa5vsvqp9bcipuu81ebssi9r8rq.apps.googleusercontent.com"//mobile
const REFRESH_INTERVAL = 3600000; //milliseconds

/*function initApiClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    scope: "https://www.googleapis.com/auth/drive.readonly",
  }).then(function () {
    console.log('Google API initialized');
  });
}

function loadClient() {
  gapi.load("client:auth2", initApiClient);
}*/

document.addEventListener("DOMContentLoaded", async () => {
  //refresh button click event to refresh API
  document.querySelector(".refresh_btn").addEventListener("click", () => {
    window.location.reload(true);
  });

  //auto refresh event 1hour
  delayedTask(REFRESH_INTERVAL);

  const get_data = await fetchData("!A:F");
  const totalProduction = await getHighestValue();
  //console.log(get_accummulatedSum);
  const text_data = await get_data.json();

  for (let i = text_data.values.length - 1; i >= 2; i--) {
    //console.log(text_data.values[i][3])
    addRow(text_data.values[i]);
  }

  const get_data2 = await fetchData("!J:N");
  const get_initbargedate = await fetchData("!P:P");
  const get_bargeDate = await get_initbargedate.json();

  const text_data2 = await get_data2.json();
  const originalDate = text_data2.values[2][0];
  const formattedDate = formatDate(originalDate);
  const originalTime = text_data2.values[2][1];
  const formattedTime = formatTime(originalTime);

  document.querySelector(".date-val").innerHTML = formattedDate;
  document.querySelector(".time-val").innerHTML = formattedTime;
  document.querySelector(".stats-val").innerHTML = text_data2.values[2][2];
  document.querySelector(".load-val").innerHTML = text_data2.values[2][3] + " kg";
  document.querySelector(".trips-val").innerHTML = text_data2.values[2][4];
  document.querySelector(".total-val").innerHTML = totalProduction + " kg";
  //document.querySelector(".d6_2").innerHTML = get_bargeDate.values[2];
});

async function fetchData(range) {
  const URL_STRING = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/ONBOARD_WEIGHING_SCALE${range}?key=${API_KEY}`;

  return await fetch(URL_STRING);
}

async function getHighestValue() {
  try {
    // Fetch the data
    const get_data = await fetchData("!S:S");
    const weightArray = await get_data.json(); // Assuming this returns an array of numbers

    let highestValue = Number.NEGATIVE_INFINITY;

    if (weightArray.values.length > 2) {
      for (let i = 2; i < weightArray.values.length; i++) {
        const num = parseFloat(weightArray.values[i]);

        if(num > highestValue){
          highestValue = num;
        }
      }
    } 
    return highestValue;
  } catch (error) {
    console.error("Error fetching data or finding the highest value:", error);
    throw error;
  }
}


function addRow(data_lst) {
  const colors = ['green', 'yellow', 'red', 'white', 'blue', 'black'];

  var table = document.getElementById("myTable");

  var newRow = document.createElement("tr");
  var cell1 = document.createElement("td");
  var cell2 = document.createElement("td");
  var cell3 = document.createElement("td");
  var cell4 = document.createElement("td");
  var cell5 = document.createElement("td");
  var cell6 = document.createElement("td");

  cell1.textContent = data_lst[0];
  cell2.textContent = data_lst[1];
  cell3.textContent = data_lst[2];
  cell4.textContent = data_lst[3];
  cell5.textContent = data_lst[4];

  colors.forEach(color => {
    const button = document.createElement("button");
    button.className = "color-button";
    button.style.backgroundColor = color;
    button.onclick = () => {
      cell6.childNodes.forEach(btn => btn.classList.remove("glow"));
      button.classList.add("glow");
    };
    cell6.appendChild(button);
  });

  const randomIndex = Math.floor(Math.random() * colors.length);
      const randomButton = cell6.childNodes[randomIndex];
      randomButton.classList.add("glow");
  

  newRow.appendChild(cell1);
  newRow.appendChild(cell2);
  newRow.appendChild(cell3);
  newRow.appendChild(cell4);
  newRow.appendChild(cell5);
  newRow.appendChild(cell6);

  table.appendChild(newRow);
}

async function delayedTask(ms) {
  await new Promise((resolve) => setTimeout(() => resolve(), ms));
  console.log("Restarting every : " + ms);
  window.location.reload(true);
}

function formatDate(dateString) {
  //console.log(dateString);
  const [day, month, year] = dateString.split('/').map(Number);
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

function openPopup() {
  document.getElementById('popupForm').style.display = 'block';
}
function closePopup() {
  document.getElementById('popupForm').style.display = 'none';
}
/*
function updateValues(spreadsheetId, range, valueInputOption, values, callback) {
  const body = { values };
  gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: valueInputOption,
    resource: body,
  }).then((response) => {
    const result = response.result;
    console.log(`${result.updatedCells} cells updated.`);
    if (callback) callback(response);
  }).catch((error) => {
    document.getElementById('content').innerText = error.message;
  });
}

function submitData() {
  const formData = {
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
    shift: ' ',//document.getElementById('shift').value,
    sensor: document.querySelector('input[name="sensor"]:checked')?.value,
    weight: document.getElementById('weight').value,
    grade: ' ',//document.querySelector('input[name="grade"]:checked')?.value,
  };

  const row = [
    formData.date,
    formData.time,
    formData.shift,
    formData.sensor,
    formData.weight,
    formData.grade,
  ];

  updateValues(SPREADSHEET_ID, "!A:F", "INSERT_ROW", [row], (response) => {
    document.getElementById('content').innerText = "Data inserted successfully!";
  });
}

document.addEventListener("DOMContentLoaded", loadClient);*/

//keytool -list -v -keystore "C:Users\Jezza Jancinal\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android