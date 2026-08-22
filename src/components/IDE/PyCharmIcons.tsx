import React from 'react';

export const PyCharmLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <div
    className={`${className} rounded bg-[#1E1F22] border border-[#393B40] flex items-center justify-center font-mono text-[10px] font-black text-white relative overflow-hidden select-none shrink-0 shadow-xs`}
    title="PyCharm"
  >
    <div className="absolute top-0 left-0 w-full h-[3px] bg-[#21D789]" />
    <span className="text-[#21D789] tracking-tighter ml-[-1px]">P</span>
    <span className="text-white tracking-tighter">C</span>
  </div>
);

export const PythonLogo: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
    <path
      d="M11.91 2C6.47 2 6.8 4.36 6.8 4.36l.01 2.45h5.18v.74H4.72S2 7.23 2 12.67c0 5.43 2.38 5.24 2.38 5.24h1.42v-2.02s-.08-2.38 2.34-2.38h3.99s2.26.04 2.26-2.22V6.26S14.86 2 11.91 2zm-1.47 1.48a.83.83 0 1 1 0 1.66.83.83 0 0 1 0-1.66z"
      fill="#387EB8"
    />
    <path
      d="M12.09 22c5.44 0 5.11-2.36 5.11-2.36l-.01-2.45h-5.18v-.74h7.27S22 16.77 22 11.33c0-5.43-2.38-5.24-2.38-5.24h-1.42v2.02s.08 2.38-2.34 2.38h-3.99s-2.26-.04-2.26 2.22v7.73S9.14 22 12.09 22zm1.47-1.48a.83.83 0 1 1 0-1.66.83.83 0 0 1 0 1.66z"
      fill="#FFE873"
    />
  </svg>
);

export const GitBranchIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

export const PyCharmFileIcon: React.FC<{ filename: string; className?: string }> = ({
  filename,
  className = 'w-3.5 h-3.5',
}) => {
  if (filename.endsWith('.py')) {
    return <PythonLogo className={className} />;
  }
  if (filename.endsWith('.js') || filename.endsWith('.ts')) {
    return (
      <span className={`${className} inline-flex items-center justify-center font-bold text-[9px] bg-[#F7DF1E] text-black rounded-xs font-mono select-none shrink-0`}>
        {filename.endsWith('.ts') ? 'TS' : 'JS'}
      </span>
    );
  }
  if (filename.endsWith('.cpp') || filename.endsWith('.c')) {
    return (
      <span className={`${className} inline-flex items-center justify-center font-bold text-[8px] bg-[#00599C] text-white rounded-xs font-mono select-none shrink-0`}>
        C++
      </span>
    );
  }
  if (filename.endsWith('.sql')) {
    return (
      <span className={`${className} inline-flex items-center justify-center font-bold text-[8px] bg-[#E38C00] text-white rounded-xs font-mono select-none shrink-0`}>
        SQL
      </span>
    );
  }
  if (filename.endsWith('.html') || filename.endsWith('.css')) {
    return (
      <span className={`${className} inline-flex items-center justify-center font-bold text-[8px] bg-[#E34F26] text-white rounded-xs font-mono select-none shrink-0`}>
        &lt;&gt;
      </span>
    );
  }
  return (
    <span className={`${className} inline-flex items-center justify-center font-bold text-[8px] bg-[#4E5157] text-[#DFE1E5] rounded-xs font-mono select-none shrink-0`}>
      TXT
    </span>
  );
};
