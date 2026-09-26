type MarqueeProps = {
  items: string[];
};

export function Marquee({ items }: MarqueeProps) {
  const sequence = [...items, ...items];

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <div className="marquee-group" key={copy}>
            {sequence.map((item, index) => (
              <span className="marquee-item" key={`${copy}-${index}`}>
                {item}
                <span className="marquee-glyph">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
