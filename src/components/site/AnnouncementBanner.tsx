import { useSiteSection } from "@/hooks/useSiteContent";

const AnnouncementBanner = () => {
  const banner = useSiteSection<{ enabled: boolean; text: string; link?: string; bg_color?: string; text_color?: string }>("announcement", { enabled: false, text: "" });
  if (!banner?.enabled || !banner.text) return null;
  
  const content = (
    <div className="container py-2.5 text-center text-xs sm:text-sm font-bold tracking-tight">
      {banner.text}
    </div>
  );

  return (
    <div 
      className="border-b border-black/5"
      style={{ 
        backgroundColor: banner.bg_color || "#FFE6B5", 
        color: banner.text_color || "#5C4327" 
      }}
    >
      {banner.link ? <a href={banner.link} className="block hover:opacity-80 transition-smooth">{content}</a> : content}
    </div>
  );
};

export default AnnouncementBanner;