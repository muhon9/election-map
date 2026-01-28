import mongoose from "mongoose";
const { Types } = mongoose;

function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}
function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export { oid, num };
