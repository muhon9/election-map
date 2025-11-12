// lib/geo-validate.js
import GeoUnit from "@/models/GeoUnit";

/**
 * Ensures the provided chain is coherent relative to GeoUnit hierarchy.
 * Accepts nullable ids; only validates provided ones.
 * Throws an Error(message) if invalid.
 */
export async function validateGeoChain({ cityId, upazilaId, unionId, wardId }) {
  const ids = { cityId, upazilaId, unionId, wardId };
  // Load provided nodes
  const [city, upa, uni, ward] = await Promise.all([
    cityId ? GeoUnit.findById(cityId).lean() : null,
    upazilaId ? GeoUnit.findById(upazilaId).lean() : null,
    unionId ? GeoUnit.findById(unionId).lean() : null,
    wardId ? GeoUnit.findById(wardId).lean() : null,
  ]);

  // Basic type checks (if present)
  if (city && city.type !== "city_corporation")
    throw new Error("cityId must be a city_corporation");
  if (upa && upa.type !== "upazila")
    throw new Error("upazilaId must be an upazila");
  if (uni && uni.type !== "union") throw new Error("unionId must be a union");
  if (ward && ward.type !== "ward") throw new Error("wardId must be a ward");

  // Mutually exclusive top-levels (optional rule; relax if you allow both)
  if (city && upa)
    throw new Error("Choose either a City or an upazila, not both");

  // City mode
  if (city) {
    if (uni)
      throw new Error("Union is not used under City; leave unionId empty");
    if (
      ward &&
      String(ward.parent) !== String(city._id) &&
      !(ward.ancestors || []).some((a) => String(a) === String(city._id))
    ) {
      throw new Error("wardId does not belong to the selected City");
    }
  }

  // upazila mode
  if (upa) {
    if (
      uni &&
      String(uni.parent) !== String(upa._id) &&
      !(uni.ancestors || []).some((a) => String(a) === String(upa._id))
    ) {
      throw new Error("unionId does not belong to the selected upazila");
    }
    if (ward) {
      // Prefer: ward -> union -> upazila chain
      const okToUpa =
        String(ward.parent) === String(upa._id) ||
        (ward.ancestors || []).some((a) => String(a) === String(upa._id));
      const okToUni =
        !uni ||
        String(ward.parent) === String(uni?._id) ||
        (ward.ancestors || []).some((a) => String(a) === String(uni?._id));
      if (!(okToUpa && okToUni)) {
        throw new Error("wardId does not belong to the selected upazila/Union");
      }
    }
  }

  // If you want at least one top-level:
  if (!city && !upa) {
    throw new Error("Provide either cityId or upazilaId");
  }

  return { city, upa, uni, ward, ids };
}
