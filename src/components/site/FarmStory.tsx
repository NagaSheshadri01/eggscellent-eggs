import farm from "@/assets/farm-story.jpg";

const FarmStory = () => (
  <section className="relative py-24 lg:py-32">
    <div className="container grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
      <div className="lg:col-span-6 relative order-2 lg:order-1">
        <div className="absolute -inset-4 gradient-yolk rounded-[2.5rem] blur-2xl opacity-15 -z-10" />
        <div className="relative rounded-[2rem] overflow-hidden shadow-card">
          <img
            src={farm}
            alt="Free range hens roaming on an organic farm"
            loading="lazy"
            width={1280}
            height={900}
            className="w-full h-[380px] sm:h-[520px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brown/40 via-transparent to-transparent" />
        </div>
        <div className="absolute -bottom-6 -right-4 sm:-right-8 glass rounded-2xl shadow-card p-5 max-w-[220px]">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Since</div>
          <div className="font-display font-bold text-brown text-3xl">1962</div>
          <div className="text-xs text-muted-foreground mt-0.5">Three generations of honest farming.</div>
        </div>
      </div>

      <div className="lg:col-span-6 order-1 lg:order-2">
        <div className="eyebrow mb-4">Our farm</div>
        <h2 className="display-2 text-brown mb-6">From our family farm,<br/><span className="italic font-normal text-accent">to yours.</span></h2>
        <p className="lead mb-5">
          Three generations ago, our grandfather started a small poultry farm in the foothills of Maharashtra with one simple promise — never compromise on the food we feed our family or our customers.
        </p>
        <p className="lead">
          Today we raise our hens cage-free, on open pastures, with sunshine and clean water. Because every great egg starts with a happy hen.
        </p>
        <div className="grid grid-cols-3 gap-6 mt-10 pt-8 border-t border-border">
          {[["50K+","Happy families"],["3","Generations"],["24h","Lay-to-door"]].map(([n,l]) => (
            <div key={l}>
              <div className="font-display font-bold text-3xl text-brown">{n}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default FarmStory;
