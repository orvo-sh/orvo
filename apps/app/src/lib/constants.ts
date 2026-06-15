const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const PLANS = {
    starter: {
        priceUsd: 19,
        retentionDays: {
            logs: 14,
            metrics: 14,
            traces: 14,
        },
        ingestLimitBytes: 50 * Math.pow(1024, 3),
        overagePricePerGb: null,
    },
    pro: {
        priceUsd: 49,
        retentionDays: {
            logs: 30,
            metrics: 30,
            traces: 30,
        },
        ingestLimitBytes: 150 * Math.pow(1024, 3),
        overagePricePerGb: 0.32,
    }
}

export { MAX_UPLOAD_FILE_SIZE_BYTES, PLANS };
