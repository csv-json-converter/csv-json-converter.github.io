document.addEventListener("DOMContentLoaded", () => {
  
  // --- State Variables ---
  let loadedFileContent = null; // String content of loaded file
  let loadedFileType = ""; // "json" or "csv"
  let loadedFileName = "";
  let convertedBlobUrl = null;
  
  // --- DOM Elements ---
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const toolBox = document.getElementById("toolBox");
  
  const stateUpload = document.getElementById("stateUpload");
  const stateLoading = document.getElementById("stateLoading");
  const stateGrid = document.getElementById("stateGrid");
  
  const loadingText = document.getElementById("loadingText");
  const labelFileName = document.getElementById("loadedFileName");
  const labelFileMeta = document.getElementById("loadedFileMeta");
  
  const btnReset = document.getElementById("btnReset");
  const btnDownload = document.getElementById("btnDownload");
  
  const gridHead = document.getElementById("gridHead");
  const gridBody = document.getElementById("gridBody");
  const rowsLimitText = document.getElementById("rowsLimitText");
  const gridContainer = document.getElementById("gridContainer");
  const jsonPreviewContainer = document.getElementById("jsonPreviewContainer");
  const jsonPreviewCode = document.getElementById("jsonPreviewCode");
  

  // --- State Transition Helper ---
  function showState(state) {
    stateUpload.classList.remove("active");
    stateLoading.classList.remove("active");
    stateGrid.classList.remove("active");
    
    if (state === "upload") stateUpload.classList.add("active");
    if (state === "loading") stateLoading.classList.add("active");
    if (state === "grid") stateGrid.classList.add("active");
  }

  // --- Drag & Drop Setup ---
  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  ["dragleave", "dragend"].forEach(type => {
    dropZone.addEventListener(type, () => {
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // --- Reset View ---
  btnReset.addEventListener("click", () => {
    loadedFileContent = null;
    loadedFileType = "";
    loadedFileName = "";
    fileInput.value = "";
    if (convertedBlobUrl) {
      URL.revokeObjectURL(convertedBlobUrl);
      convertedBlobUrl = null;
    }
    gridHead.innerHTML = "";
    gridBody.innerHTML = "";
    jsonPreviewCode.textContent = "";
    gridContainer.style.display = "block";
    jsonPreviewContainer.style.display = "none";
    showState("upload");
  });

  // --- File Reader & Type Router ---
  function handleFileSelection(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension !== "json" && extension !== "csv") {
      alert("Unsupported file type. Please upload a .json or .csv file.");
      return;
    }

    loadedFileName = file.name;
    loadedFileType = extension;
    showState("loading");
    loadingText.textContent = "Reading file...";

    const reader = new FileReader();
    reader.onload = (e) => {
      loadedFileContent = e.target.result;
      processDataset();
    };
    reader.onerror = () => {
      alert("Failed to read file.");
      showState("upload");
    };
    reader.readAsText(file);
  }

  // --- Main Dataset Processing Router ---
  function processDataset() {
    loadingText.textContent = "Parsing dataset...";
    
    // Defer processing to let the loading spinner render
    setTimeout(() => {
      try {
        if (loadedFileType === "json") {
          processJson();
        } else if (loadedFileType === "csv") {
          processCsv();
        }
      } catch (err) {
        console.error(err);
        alert("Parser Error: The file content is corrupt or improperly formatted.");
        showState("upload");
      }
    }, 50);
  }

  // --- JSON processing (JSON ➔ CSV) ---
  function processJson() {
    let rawData = JSON.parse(loadedFileContent);
    
    // Force array structure if it's a single object
    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }
    
    if (rawData.length === 0) {
      alert("JSON array is empty.");
      showState("upload");
      return;
    }

    // Flatten nested objects
    const flattenedData = rawData.map(item => flattenObject(item));
    
    // Extract unique headers
    const allKeys = new Set();
    flattenedData.forEach(item => {
      Object.keys(item).forEach(k => allKeys.add(k));
    });
    const headers = Array.from(allKeys);

    // Build CSV Content
    const csvRows = [];
    csvRows.push(headers.map(h => escapeCsvCell(h)).join(",")); // Header row
    
    flattenedData.forEach(item => {
      const row = headers.map(h => {
        const val = item[h];
        return escapeCsvCell(val !== undefined && val !== null ? val : "");
      });
      csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    
    // Set Download Target
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    convertedBlobUrl = URL.createObjectURL(blob);
    
    btnDownload.href = convertedBlobUrl;
    btnDownload.download = loadedFileName.replace(/\.json$/i, ".csv");
    btnDownload.textContent = "Download CSV";
    
    labelFileName.textContent = loadedFileName;
    labelFileMeta.textContent = `JSON File \u2022 ${rawData.length} rows`;
    
    // Display spreadsheet table preview
    gridContainer.style.display = "block";
    jsonPreviewContainer.style.display = "none";
    
    // Draw Preview Grid
    drawGrid(headers, flattenedData);
  }

  // --- CSV processing (CSV ➔ JSON) ---
  function processCsv() {
    const lines = parseCsvRows(loadedFileContent);
    
    if (lines.length === 0 || lines[0].length === 0) {
      alert("CSV file is empty.");
      showState("upload");
      return;
    }
    
    const headers = lines[0].map(h => h.trim());
    const rows = lines.slice(1).filter(r => r.length > 0 && (r.length > 1 || r[0] !== ""));
    
    // Map rows to objects
    const records = rows.map(row => {
      const flatObj = {};
      headers.forEach((h, index) => {
        flatObj[h] = row[index] !== undefined ? row[index] : "";
      });
      return unflattenObject(flatObj);
    });

    const jsonString = JSON.stringify(records, null, 2);
    
    // Set Download Target
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    convertedBlobUrl = URL.createObjectURL(blob);
    
    btnDownload.href = convertedBlobUrl;
    btnDownload.download = loadedFileName.replace(/\.csv$/i, ".json");
    btnDownload.textContent = "Download JSON";
    
    labelFileName.textContent = loadedFileName;
    labelFileMeta.textContent = `CSV File \u2022 ${rows.length} rows`;
    
    // Display JSON code preview
    gridContainer.style.display = "none";
    jsonPreviewContainer.style.display = "block";
    
    const previewLimit = Math.min(records.length, 100);
    const previewRecords = records.slice(0, previewLimit);
    jsonPreviewCode.textContent = JSON.stringify(previewRecords, null, 2);
    
    if (records.length > 100) {
      rowsLimitText.textContent = `Showing first 100 records of ${records.length} total records.`;
    } else {
      rowsLimitText.textContent = `Showing all ${records.length} records.`;
    }
    
    showState("grid");
  }

  // --- HTML Data Grid Render ---
  function drawGrid(headers, data) {
    gridHead.innerHTML = "";
    gridBody.innerHTML = "";
    
    // 1. Populate Headers
    const trHead = document.createElement("tr");
    headers.forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      trHead.appendChild(th);
    });
    gridHead.appendChild(trHead);
    
    // 2. Populate Body (Preview limit = 100 rows)
    const limit = Math.min(data.length, 100);
    for (let i = 0; i < limit; i++) {
      const item = data[i];
      const tr = document.createElement("tr");
      headers.forEach(h => {
        const td = document.createElement("td");
        td.textContent = item[h] !== undefined ? item[h] : "";
        tr.appendChild(td);
      });
      gridBody.appendChild(tr);
    }
    
    // 3. Status limit text
    if (data.length > 100) {
      rowsLimitText.textContent = `Showing first 100 rows of ${data.length} total rows.`;
    } else {
      rowsLimitText.textContent = `Showing all ${data.length} rows.`;
    }
    
    showState("grid");
  }

  // --- Parser Helpers ---

  // Recursive object flattener (creates dot-notation key structures)
  function flattenObject(obj, prefix = "") {
    return Object.keys(obj).reduce((acc, k) => {
      const pre = prefix.length ? prefix + "." : "";
      if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  // Dot-notation key unflattener (maps dotted CSV headers to nested JSON objects)
  function unflattenObject(flatObj) {
    const result = {};
    Object.keys(flatObj).forEach(key => {
      const parts = key.split(".");
      let current = result;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = flatObj[key];
        } else {
          if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
          }
          current = current[part];
        }
      }
    });
    return result;
  }

  // Escape special characters in CSV cells
  function escapeCsvCell(val) {
    let str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    }
    return str;
  }

  // Robust CSV parser supporting quotes and cell linebreaks
  function parseCsvRows(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i+1];
      
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',') {
        if (inQuotes) {
          row[row.length - 1] += c;
        } else {
          row.push("");
        }
      } else if (c === '\n' || c === '\r') {
        if (inQuotes) {
          row[row.length - 1] += c;
        } else {
          if (c === '\r' && next === '\n') {
            i++;
          }
          lines.push(row);
          row = [""];
        }
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  }



});
