import { includeBytes } from "fastly:experimental";

const textDecoder = new TextDecoder();
const styles = textDecoder.decode(includeBytes('src/static/style.css'));

// Injects styles and props into the given template.
export default function processView(template, props) {
  for (let key in props) {
    template = template.replace(
      new RegExp(`{{\\s?${key}\\s?}}`, "g"),
      props[key]
    );
  }
  return template.replace(
    "</head>",
    "<style>" + styles.replace(new RegExp("\n", "g"), "") + "</style></head>"
  );
}
