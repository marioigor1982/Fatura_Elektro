export function NeoenergiaHeader() {
  return (
    <div
      className="bg-white border-b-[1.5px] border-x-[1.5px] border-t-0 border-[#28B463] rounded-b-[14px] px-5 sm:px-8 pt-3.5 pb-3"
      aria-label="Cabeçalho Oficial Neoenergia Elektro"
    >
      <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
        {/* Left Brand Block: Exact Neoenergia Elektro Lockup */}
        <div className="md:w-[35%] shrink-0 flex flex-col justify-between">
          <div className="flex items-start gap-2.5 pl-2 sm:pl-5">
            {/* Three-leaf / flame droplet mark (Green, Cyan-Blue, Orange) */}
            <svg
              viewBox="0 0 68 62"
              className="w-[54px] h-[50px] sm:w-[60px] sm:h-[54px] shrink-0 -mt-0.5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Green left leaf with curved stem */}
              <path
                d="M19.5 6.5C15.5 14 5.5 23.5 5.5 34.5C5.5 41.8 10.6 46.8 17.5 46.8C16.2 42 16.5 35.8 18.8 29.8C21.1 23.8 23.6 18 22.8 10.8C22.5 8.2 21.1 6.7 19.5 6.5Z"
                fill="#009E49"
              />
              <path
                d="M12.5 45.2C10.8 49 10.5 52.8 11.4 56.2C11.8 57.2 13.1 56.8 13.1 55.6C13.1 52.6 13.7 49.4 15.2 46.2"
                stroke="#009E49"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* Sky Blue center flame */}
              <path
                d="M35.5 4C31.5 12.2 20.8 22.8 20.8 34.6C20.8 42.2 26.2 47.4 33.4 47.4C31.8 42.5 32.1 35.4 35.1 28.4C37.6 22.5 40.3 15.5 38.8 8.3C38.3 5.8 36.9 4.2 35.5 4Z"
                fill="#00A3E0"
              />
              {/* Warm Orange right flame */}
              <path
                d="M52.8 8.8C49.2 16.2 35.8 26.8 35.8 37.8C35.8 44.6 41.2 49.2 48.2 49.2C54.6 49.2 60.2 43.8 60.2 35.2C60.2 25.4 55.6 15.6 54.4 10.6C54.1 9.4 53.4 8.7 52.8 8.8Z"
                fill="#F37021"
              />
            </svg>

            {/* Wordmark: Neoenergia / Elektro */}
            <div className="flex flex-col leading-none pt-1.5">
              <span
                className="text-[28px] sm:text-[32px] font-medium tracking-[-0.025em] text-[#009E49] select-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Neoenergia
              </span>
              <span
                className="text-[18px] sm:text-[21px] font-normal tracking-[-0.015em] text-[#009E49] mt-0.5 select-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Elektro
              </span>
            </div>
          </div>

          <p className="mt-2.5 text-[11.5px] sm:text-[12.5px] font-bold text-[#009E49] tracking-[-0.01em] whitespace-nowrap">
            neoenergia.com/sp | Ligue grátis 0800 701 01 02
          </p>
        </div>

        {/* Right Fiscal Block: Exact DANFE / Elektro Redes S.A. */}
        <div className="flex-1 flex flex-col justify-start text-left md:pl-2">
          <p className="text-[11px] sm:text-[12px] font-medium text-[#3F3F46] tracking-[0.005em] leading-snug">
            DANFE- DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
          </p>
          <p className="text-[12.5px] sm:text-[13.5px] font-bold text-[#3F3F46] leading-snug mt-0.5">
            Elektro Redes S.A.
          </p>

          <div className="mt-3 sm:mt-4 text-[11.5px] sm:text-[12px] leading-[1.35] text-[#111827] font-normal space-y-[1px]">
            <p>R Ary Antenor de Souza, 321 - Jd Nova America</p>
            <p>CEP: 13053-024 - Campinas - SP</p>
            <p className="tabular-nums">CNPJ 02.328.280/0001-97</p>
            <p className="tabular-nums">INSC. ESTADUAL 244868522118</p>
          </div>
        </div>
      </div>
    </div>
  );
}
