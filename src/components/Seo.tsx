import { useEffect } from "react";

type Props = {
  title: string;
  description?: string;
  canonical?: string;
  jsonLd?: object | object[];
};

const upsertMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const Seo = ({ title, description, canonical, jsonLd }: Props) => {
  useEffect(() => {
    document.title = title;
    if (description) {
      upsertMeta("description", description);
      upsertMeta("og:description", description, "property");
      upsertMeta("twitter:description", description);
    }
    upsertMeta("og:title", title, "property");
    upsertMeta("twitter:title", title);
    upsertMeta("twitter:card", "summary_large_image");

    const url = canonical || window.location.href;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);

    // JSON-LD
    document.querySelectorAll('script[data-seo-jsonld="true"]').forEach(n => n.remove());
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      blocks.forEach(obj => {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.dataset.seoJsonld = "true";
        s.text = JSON.stringify(obj);
        document.head.appendChild(s);
      });
    }
  }, [title, description, canonical, JSON.stringify(jsonLd)]);
  return null;
};

export default Seo;
