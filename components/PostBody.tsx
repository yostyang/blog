import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getImageSize } from "@/lib/image-size";

function paragraphIsOnlyImage(node: { children?: Array<{ type: string; tagName?: string; value?: string }> } | undefined) {
  const children = (node?.children ?? []).filter((child) => {
    if (child.type === "text") return (child.value ?? "").trim() !== "";
    return true;
  });
  return children.length === 1 && children[0].type === "element" && children[0].tagName === "img";
}

export function PostBody({ markdown }: { markdown: string }) {
  const sequence = { index: 0 };
  const components: Components = {
    h2: ({ children }) => {
      const id = `sec-${sequence.index}`;
      sequence.index += 1;
      return <h2 id={id}>{children}</h2>;
    },
    h3: ({ children }) => {
      const id = `sec-${sequence.index}`;
      sequence.index += 1;
      return <h3 id={id}>{children}</h3>;
    },
    p: ({ children, node }) => {
      if (paragraphIsOnlyImage(node)) return <>{children}</>;
      return <p>{children}</p>;
    },
    img: ({ src, alt }) => {
      const source = typeof src === "string" ? src : "";
      const size = source ? getImageSize(source) : undefined;
      return (
        <figure>
          <img
            src={source}
            alt={alt ?? ""}
            width={size?.width}
            height={size?.height}
            loading="lazy"
            decoding="async"
          />
        </figure>
      );
    },
    a: ({ href, children }) => {
      const external = typeof href === "string" && /^https?:\/\//.test(href);
      return (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
          {children}
        </a>
      );
    },
  };

  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
