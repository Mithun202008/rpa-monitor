(function() {
  let memoryPool = [];
  let isInitialized = false;

  const randomRange = (min, max) => Math.random() * (max - min) + min;

  const INT_FIELDS = ['robots_deployed', 'budget_usd', 'annual_savings_usd', 'employee_hours_saved', 'employee_count', 'annual_revenue_usd', 'customer_count', 'founded_year'];
  const FLOAT_FIELDS = ['roi_percent', 'market_share_percent'];

  const parseCSV = (csvText) => {
    console.log("⚡ [Pipeline Engine] Parsing Official Hackathon CSV into Memory Pool...");
    const lines = csvText.trim().split('\n');

    const headers = lines[0].split('\t').length > lines[0].split(',').length
      ? lines[0].split('\t').map(h => h.trim())
      : lines[0].split(',').map(h => h.trim());

    const parsedData = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].includes('\t') ? lines[i].split('\t') : lines[i].split(',');

      if (values.length === headers.length) {
        let rowObject = { internal_uid: `uid-row-${i}` };

        headers.forEach((header, index) => {
          let val = values[index].trim();

          if (INT_FIELDS.includes(header)) {
            rowObject[header] = parseInt(val, 10) || 0;
          } else if (FLOAT_FIELDS.includes(header)) {
            rowObject[header] = parseFloat(val) || 0.00;
          } else {
            rowObject[header] = val;
          }
        });
        parsedData.push(rowObject);
      }
    }
    return parsedData;
  };

  window.initializeRpaStream = async function(callback, csvUrl = '/rpa_database_2026.csv') {
    if (typeof callback !== 'function') {
      console.error("❌ [Pipeline Error] initializeRpaStream requires a callback function execution loop.");
      return;
    }

    if (isInitialized) {
      console.warn("⚠️ [Pipeline Warning] Telemetry stream has already been initialized.");
      return;
    }

    try {
      console.log(`📦 [Pipeline Engine] Fetching schema baseline from target destination: ${csvUrl}`);
      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error(`HTTP network error! status: ${response.status}`);
      }

      const csvText = await response.text();
      memoryPool = parseCSV(csvText);
      isInitialized = true;

      console.log(`✅ [Pipeline Engine] Successfully mapped ${memoryPool.length} rows directly into RAM.`);
      console.log("🚀 [Pipeline Engine] Starting high-frequency 200ms background execution firehose...");

      setInterval(() => {
        if (memoryPool.length === 0) {
          console.warn('⚠️ memoryPool is empty, skipping tick');
          return;
        }

        const batchSize = Math.floor(randomRange(5, 50));
        console.log(`📊 dataStream tick: batchSize=${batchSize}, memoryPool=${memoryPool.length}`);
        const incomingBatch = [];

        for (let i = 0; i < batchSize; i++) {
          const targetIndex = Math.floor(randomRange(0, memoryPool.length));
          const row = { ...memoryPool[targetIndex] };

          const isAnomaly = Math.random() > 0.95;

          if (isAnomaly) {
            row.robots_deployed += Math.floor(randomRange(-15, 40));
            row.annual_savings_usd += Math.floor(randomRange(-200000, 500000));
            row.employee_hours_saved += Math.floor(randomRange(-5000, 10000));
            row.roi_percent = randomRange(-60, -5) + (Math.random() > 0.5 ? randomRange(0, 15) : 0);
            row.budget_usd += Math.floor(randomRange(-200000, 100000));
          } else {
            row.robots_deployed += Math.floor(randomRange(-2, 5));
            row.annual_savings_usd += Math.floor(randomRange(-3000, 15000));
            row.employee_hours_saved += Math.floor(randomRange(-100, 800));
            row.budget_usd += Math.floor(randomRange(-10000, 40000));
            row.roi_percent += randomRange(-3, 5);
          }

          row.robots_deployed = Math.max(0, Math.round(row.robots_deployed));
          row.annual_savings_usd = Math.max(0, row.annual_savings_usd);
          row.employee_hours_saved = Math.max(0, Math.round(row.employee_hours_saved));
          row.budget_usd = Math.max(0, row.budget_usd);
          row.roi_percent = parseFloat(Math.max(-99, Math.min(999, row.roi_percent)).toFixed(2));

          memoryPool[targetIndex] = row;
          incomingBatch.push(row);
        }

        callback(incomingBatch);
      }, 200);

    } catch (error) {
      console.error("❌ [Pipeline Critical Crash] Could not initialize telemetry stream:", error);
      console.error("👉 Fix Checklist: Verify server configuration, absolute path constraints, or check if the asset is missing inside your root public/ directory.");
    }
  };
})();
