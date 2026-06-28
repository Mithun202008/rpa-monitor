const ANOMALY_FAILED_CHANCE = 0.03;

export function wrapStreamCallback(engine) {
  let count = 0;
  return function (incomingBatch) {
    count++;
    const failed = incomingBatch.filter(r => r.project_status === 'Failed');
    const patched = incomingBatch.map(row => {
      const r = { ...row };
      if (Math.random() < ANOMALY_FAILED_CHANCE) {
        r.project_status = 'Failed';
      }
      return r;
    });
    const patchedFailed = patched.filter(r => r.project_status === 'Failed');
    console.log(`⚡ streamWire #${count}: ${incomingBatch.length} rows, ${failed.length} already Failed, ${patchedFailed.length} patched to Failed (3%)`);
    engine.process(patched);
  };
}
