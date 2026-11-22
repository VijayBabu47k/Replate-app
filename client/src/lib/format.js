import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LuFlame, LuThermometer, LuSnowflake, LuBike, LuCar, LuTruck } from 'react-icons/lu';
import { MdOutlineTwoWheeler } from 'react-icons/md';

dayjs.extend(relativeTime);

export const STATUS = {
  POSTED: { label: 'Posted', color: 'info', step: 0 },
  CLAIMED: { label: 'Claimed', color: 'secondary', step: 1 },
  ASSIGNED: { label: 'Volunteer assigned', color: 'secondary', step: 2 },
  COLLECTED: { label: 'Collected', color: 'warning', step: 3 },
  DELIVERED: { label: 'Delivered', color: 'success', step: 4 },
  REJECTED: { label: 'Rejected at delivery', color: 'error', step: -1 },
  EXPIRED: { label: 'Expired', color: 'default', step: -1 },
  CANCELLED: { label: 'Cancelled', color: 'default', step: -1 },
};

export const FLOW = ['POSTED', 'CLAIMED', 'ASSIGNED', 'COLLECTED', 'DELIVERED'];

export const DIET = {
  VEG: { label: 'Veg', cls: 'bg-green-100 text-green-800 border-green-300' },
  JAIN: { label: 'Jain', cls: 'bg-lime-100 text-lime-800 border-lime-300' },
  VEGAN: { label: 'Vegan', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  EGG: { label: 'Egg', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  NON_VEG: { label: 'Non-veg', cls: 'bg-red-100 text-red-800 border-red-300' },
};

export const STORAGE = {
  HOT_HELD: { label: 'Hot-held (>60°C)', short: 'Hot-held', Icon: LuFlame, tone: 'orange' },
  ROOM_TEMP: { label: 'Room temperature', short: 'Room temp', Icon: LuThermometer, tone: 'amber' },
  REFRIGERATED: { label: 'Refrigerated (<5°C)', short: 'Chilled', Icon: LuSnowflake, tone: 'blue' },
};

export const UNIT = { KG: 'kg', SERVINGS: 'servings', TRAYS: 'trays', VESSELS: 'vessels' };
export const VEHICLE = { BICYCLE: 'Bicycle', BIKE: 'Bike / scooter', CAR: 'Car', VAN: 'Van' };
export const VEHICLE_ICON = { BICYCLE: LuBike, BIKE: MdOutlineTwoWheeler, CAR: LuCar, VAN: LuTruck };
export const ROLE_LABEL = { DONOR: 'Donor', RECEIVER: 'Receiver', VOLUNTEER: 'Volunteer' };

export const fmtTime = (d) => dayjs(d).format('h:mm A');
export const fmtDateTime = (d) => dayjs(d).format('D MMM, h:mm A');
export const fmtDate = (d) => dayjs(d).format('D MMM YYYY');
export const fromNow = (d) => dayjs(d).fromNow();
export const num = (n) => (n ?? 0).toLocaleString('en-IN');
export const inr = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
