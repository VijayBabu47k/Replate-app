import { LuLeaf } from 'react-icons/lu';

/** App logo: gradient leaf tile + wordmark. */
export function BrandMark({ size = 36 }) {
  return (
    <span className="icon-tile solid" style={{ width: size, height: size, borderRadius: size * 0.32 }}>
      <LuLeaf style={{ fontSize: size * 0.52 }} />
    </span>
  );
}

export default function Brand({ size = 36, sub }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="leading-tight">
        <span className="block text-[17px] font-semibold tracking-tight text-gray-900">Re<span className="text-accent">Plate</span></span>
        {sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
      </span>
    </span>
  );
}
