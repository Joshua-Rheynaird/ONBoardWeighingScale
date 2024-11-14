const SPREADSHEET_ID = "1fbiqeuKFJHd0xR2qI2HixXGYCgwN1suxMI2BXrH4uNg";
const API_KEY = "AIzaSyC-7jwS9MVNWppcrztoXuVr9ZTIfFSvH1M";
const REFRESH_INTERVAL = 3600000; //milliseconds

document.addEventListener("DOMContentLoaded", async () => {
  //refresh button click event to refresh API
  document.querySelector(".refresh_btn").addEventListener("click", () => {
    window.location.reload(true);
  });

  //auto refresh event 1hour
  delayedTask(REFRESH_INTERVAL);

  const get_data = await fetchData("!A:E");
  const get_accummulatedSum = await getSum();
  console.log(get_accummulatedSum);
  const text_data = await get_data.json();
  //console.log(text_data)
  //console.log(text_data.values[0][0])
  //Title and column header for logger
  document.querySelector(".Title1").innerHTML = text_data.values[0][0];
  document.querySelector(".c1").innerHTML = text_data.values[1][0];
  document.querySelector(".c2").innerHTML = text_data.values[1][1];
  document.querySelector(".c3").innerHTML = text_data.values[1][2];
  document.querySelector(".c4").innerHTML = text_data.values[1][3];
  //   document.querySelector(".c5").innerHTML = text_data.values[1][4];
  //loop data for logger
  //title and column header is not included in loop len-2
  //reverse order since last data log is the latest data
  for (let i = text_data.values.length - 1; i >= 2; i--) {
    //console.log(i)
    addRow(text_data.values[i]);
  }

  const get_data2 = await fetchData("!I:M");
  const get_initbargedate = await fetchData("!O:O");
  const get_bargeDate = await get_initbargedate.json();

  const text_data2 = await get_data2.json();
  console.log(get_bargeDate);
  //data for current log
  //Title and column header
  // const date = new Date();
  // const formattedDate =
  //   date.toISOString().split("T")[0] + " " + date.toTimeString().split(" ")[0];
  // console.log(formattedDate);
  // document.querySelector(".as_off").innerHTML = formattedDate;

  document.querySelector(".Title2").innerHTML = "ONBoard Weighing Scale";
  document.querySelector(".c1_2").innerHTML =
    "Current Values as of Date" + " : ";
  document.querySelector(".c2_2").innerHTML = text_data2.values[1][1] + " : ";
  document.querySelector(".c3_2").innerHTML = "On-board / Off - board" + " : ";
  document.querySelector(".c4_2").innerHTML = "Recent Load" + " : ";
  document.querySelector(".c5_2").innerHTML = "Barging to date (kg)" + " : ";
  document.querySelector(".c6_2").innerHTML = "From" + " : ";
  document.querySelector(".d1_2").innerHTML = text_data2.values[2][0];
  document.querySelector(".d2_2").innerHTML = text_data2.values[2][1];
  document.querySelector(".d3_2").innerHTML = text_data2.values[2][2];
  document.querySelector(".d4_2").innerHTML = text_data2.values[2][3];
  document.querySelector(".d5_2").innerHTML = get_accummulatedSum.toFixed(2);
  document.querySelector(".d6_2").innerHTML = get_bargeDate.values[2];
});

async function fetchData(range) {
  const URL_STRING = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/ONBOARD_WEIGHING_SCALE${range}?key=${API_KEY}`;

  return await fetch(URL_STRING);
}

async function getSum() {
  const get_data = await fetchData("!R:R");
  const weightArray = await get_data.json();
  let sum = 0;

  if (weightArray.values.length > 2) {
    for (var i = 2; i < weightArray.values.length; i++) {
      sum += parseFloat(weightArray.values[i]);
    }
    return sum;
  } else {
    return 0;
  }
}

function addRow(data_lst) {
  // Get the table by ID
  var table = document.getElementById("myTable");

  // Create a new row and cells
  var newRow = document.createElement("tr");
  var cell1 = document.createElement("td");
  var cell2 = document.createElement("td");
  var cell3 = document.createElement("td");
  var cell4 = document.createElement("td");
  //   var cell5 = document.createElement("td");

  // Add text to the new cells
  cell1.textContent = data_lst[0];
  cell2.textContent = data_lst[1];
  cell3.textContent = data_lst[2];
  cell4.textContent = data_lst[3];
  //   cell5.textContent = data_lst[4];

  // Append the cells to the new row
  newRow.appendChild(cell1);
  newRow.appendChild(cell2);
  newRow.appendChild(cell3);
  newRow.appendChild(cell4);
  //   newRow.appendChild(cell5);

  // Append the new row to the table
  table.appendChild(newRow);
}

async function delayedTask(ms) {
  await new Promise((resolve) => setTimeout(() => resolve(), ms));
  console.log("Restarting every : " + ms);
  window.location.reload(true);
}
