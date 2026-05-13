import { useSiteSection } from "@/hooks/useSiteContent";

const AnnouncementBanner = () => {
  const banner = useSiteSection<{ enabled: boolean; text: string; link?: string }>("announcement", { enabled: false, text: "" });
  if (!banner?.enabled || !banner.text) return null;
  const content = (
    <div className="container py-2 text-center text-sm font-medium text-brown">
      {banner.text}
    </div>
  );
  return (
    <div className="bg-primary/15 border-b border-primary/20">
      {banner.link ? <a href={banner.link} className="block hover:bg-primary/20 transition-smooth">{content}</a> : content}
    </div>
  );
};

export default AnnouncementBanner;