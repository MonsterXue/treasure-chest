export interface MediaCandidate {
  id: string;
  kind: string;
  source: string;
  contentType: "url" | "svg";
  value: string;
  element: Element;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const elementIds = new WeakMap<Element, number>();
let nextElementId = 1;

const getElementId = (element: Element) => {
  const existingId = elementIds.get(element);
  if (existingId) return existingId;

  const id = nextElementId++;
  elementIds.set(element, id);
  return id;
};

const resolveUrl = (url: string) => {
  const value = url.trim();
  if (!value) return "";

  try {
    return new URL(value, document.baseURI).href;
  } catch {
    return value;
  }
};

const parseSrcset = (srcset: string) => {
  return srcset
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map(resolveUrl);
};

const parseCssUrls = (value: string) => {
  const urls: string[] = [];
  const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    const url = resolveUrl(match[2]);
    if (url) urls.push(url);
  }

  return urls;
};

const serializeSvg = (svg: SVGSVGElement) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", SVG_NAMESPACE);

  if (clone.outerHTML.includes("xlink:")) {
    clone.setAttribute("xmlns:xlink", XLINK_NAMESPACE);
  }

  return new XMLSerializer().serializeToString(clone);
};

const findRootSvg = (element: SVGElement) => {
  let svg = element instanceof SVGSVGElement ? element : element.ownerSVGElement;
  if (!svg) return;

  while (svg.ownerSVGElement) {
    svg = svg.ownerSVGElement;
  }

  return svg;
};

export const collectMediaCandidates = (elements: Element[]) => {
  const result: MediaCandidate[] = [];
  const seenUrls = new Set<string>();
  const seenSvgElements = new Set<SVGSVGElement>();
  const seenSvgValues = new Set<string>();

  const add = (
    element: Element,
    kind: string,
    source: string,
    url?: string,
  ) => {
    if (!url) return;
    const resolvedUrl = resolveUrl(url);
    if (!resolvedUrl || seenUrls.has(resolvedUrl)) return;

    seenUrls.add(resolvedUrl);
    result.push({
      id: `${result.length}-${source}-${resolvedUrl}`,
      kind,
      source,
      contentType: "url",
      value: resolvedUrl,
      element,
    });
  };

  const addInlineSvg = (element: SVGElement) => {
    const svg = findRootSvg(element);
    if (!svg || seenSvgElements.has(svg)) return;

    seenSvgElements.add(svg);
    const value = serializeSvg(svg);
    if (seenSvgValues.has(value)) return;

    seenSvgValues.add(value);
    const id = `inline-svg-${getElementId(svg)}`;
    result.push({
      id,
      kind: "内联 SVG",
      source: "SVG 源码",
      contentType: "svg",
      value,
      element: svg,
    });
  };

  elements.forEach((element) => {
    if (element instanceof HTMLImageElement) {
      add(element, "图片", "currentSrc", element.currentSrc);
      add(element, "图片", "src", element.getAttribute("src") ?? undefined);
      parseSrcset(element.getAttribute("srcset") ?? "").forEach((url) => {
        add(element, "图片", "srcset", url);
      });
    }

    if (element instanceof HTMLVideoElement) {
      add(element, "视频", "currentSrc", element.currentSrc);
      add(element, "视频", "src", element.getAttribute("src") ?? undefined);
      add(element, "视频封面", "poster", element.poster);
      element.querySelectorAll("source").forEach((source) => {
        add(element, "视频", "source", source.src);
        parseSrcset(source.srcset).forEach((url) => {
          add(element, "视频", "source srcset", url);
        });
      });
    }

    if (element instanceof HTMLAudioElement) {
      add(element, "音频", "currentSrc", element.currentSrc);
      add(element, "音频", "src", element.getAttribute("src") ?? undefined);
      element.querySelectorAll("source").forEach((source) => {
        add(element, "音频", "source", source.src);
      });
    }

    if (element instanceof HTMLSourceElement) {
      const mediaElement = element.parentElement ?? element;
      add(mediaElement, "媒体", "source", element.src);
      parseSrcset(element.srcset).forEach((url) => {
        add(mediaElement, "媒体", "source srcset", url);
      });
    }

    if (typeof SVGImageElement !== "undefined" && element instanceof SVGImageElement) {
      add(
        element,
        "SVG 图片",
        "href",
        element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? undefined,
      );
    }

    if (typeof SVGElement !== "undefined" && element instanceof SVGElement) {
      addInlineSvg(element);
    }

    const style = window.getComputedStyle(element);
    parseCssUrls(style.backgroundImage).forEach((url) => {
      add(element, "背景图", "background-image", url);
    });
    parseCssUrls(style.maskImage).forEach((url) => {
      add(element, "遮罩图", "mask-image", url);
    });
  });

  return result;
};
