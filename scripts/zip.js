import { crc32, deflateRawSync } from "node:zlib";

const stamp = () => {
  const now = new Date(2024, 0, 1, 0, 0, 0);

  return [
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
  ];
};

export const zip = (files) => {
  const [time, date] = stamp();
  const parts = [];
  const index = [];
  let offset = 0;

  for (const { name, data } of files) {
    const raw = Buffer.from(data);
    const packed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const header = Buffer.alloc(30);

    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(Buffer.byteLength(name), 26);
    header.writeUInt16LE(0, 28);

    parts.push(header, Buffer.from(name), packed);
    index.push({ name, crc, packed: packed.length, raw: raw.length, offset });
    offset += header.length + Buffer.byteLength(name) + packed.length;
  }

  const directory = Buffer.concat(
    index.map((file) => {
      const entry = Buffer.alloc(46);

      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(20, 4);
      entry.writeUInt16LE(20, 6);
      entry.writeUInt16LE(0, 8);
      entry.writeUInt16LE(8, 10);
      entry.writeUInt16LE(time, 12);
      entry.writeUInt16LE(date, 14);
      entry.writeUInt32LE(file.crc, 16);
      entry.writeUInt32LE(file.packed, 20);
      entry.writeUInt32LE(file.raw, 24);
      entry.writeUInt16LE(Buffer.byteLength(file.name), 28);
      entry.writeUInt32LE(file.offset, 42);

      return Buffer.concat([entry, Buffer.from(file.name)]);
    }),
  );

  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(index.length, 8);
  end.writeUInt16LE(index.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, directory, end]);
};
