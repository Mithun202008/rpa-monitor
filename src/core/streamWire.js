const ANOMALY_FAILED_CHANCE = 0.03;

export function wrapStreamCallback(engine) {
  return function (incomingBatch) {
    const patched = incomingBatch.map(row => {
      const r = { ...row };
      if (Math.random() < ANOMALY_FAILED_CHANCE) {
        r.project_status = 'Failed';
      }
      return r;
    });
    engine.process(patched);
  };
}
