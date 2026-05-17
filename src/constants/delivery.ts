export const DELIVERY_SLOTS = {
  MORNING: { id: "slot_8_12", label: "Morning Shift (8:00 AM - 12:00 PM)", start: "08:00", end: "12:00", cutoff: "09:30" },
  AFTERNOON: { id: "slot_14_18", label: "Afternoon Shift (2:00 PM - 6:00 PM)", start: "14:00", end: "18:00", cutoff: "16:00" },
  EVENING: { id: "slot_18_20", label: "Evening Shift (6:00 PM - 8:00 PM)", start: "18:00", end: "20:00", cutoff: "18:30" }
};

export type DeliverySlotKey = keyof typeof DELIVERY_SLOTS;

export const getSlotLabel = (id: string) => {
  const slot = Object.values(DELIVERY_SLOTS).find(s => s.id === id);
  return slot ? slot.label : "Standard Delivery";
};
