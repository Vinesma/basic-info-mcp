// Unit conversion with no external dependencies.

type Dimension = {
    [unit: string]: number; // multiplier to convert unit -> base
};

const LENGTH: Dimension = {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    um: 1e-6,
    mi: 1609.344,
    yd: 0.9144,
    ft: 0.3048,
    in: 0.0254,
    nm: 1e-9,
};

const MASS: Dimension = {
    kg: 1,
    g: 0.001,
    mg: 1e-6,
    lb: 0.45359237,
    oz: 0.0283495231,
    t: 1000,
};

const VOLUME: Dimension = {
    l: 1,
    ml: 0.001,
    m3: 1000,
    cm3: 1, // cc == ml in base (l)
    gal_us: 3.785411784,
    qt_us: 0.946352946,
    pt_us: 0.473176473,
    cup_us: 0.2365882365,
    floz_us: 0.0295735295625,
};

const AREA: Dimension = {
    "m^2": 1,
    ha: 10000,
    "km^2": 1_000_000,
    "ft^2": 0.09290304,
    "in^2": 0.00064516,
    acre: 4046.8564224,
};

const SPEED: Dimension = {
    "m/s": 1,
    "km/h": 0.277777778,
    "mph": 0.44704,
    "kt": 0.5144444444,
};

export const DIMENSIONS = {
    length: { table: LENGTH, symbol: "m" },
    mass: { table: MASS, symbol: "kg" },
    volume: { table: VOLUME, symbol: "l" },
    area: { table: AREA, symbol: "m^2" },
    speed: { table: SPEED, symbol: "m/s" },
};

export function convertUnits(
    value: number,
    from: string,
    to: string,
    dimension: keyof typeof DIMENSIONS = "length",
): string {
    const table = DIMENSIONS[dimension].table;
    if (!(from in table) || !(to in table)) {
        throw new Error(
            `Unknown unit. Supported: ${Object.keys(table).join(", ")}`,
        );
    }
    const base = value * table[from];
    const result = base / table[to];
    return `${formatNumber(result)} ${to}`;
}

function formatNumber(n: number): string {
    // Avoid floating point noise while preserving precision.
    return parseFloat(n.toPrecision(12)).toString();
}
