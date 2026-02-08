// docs/spikes/spike-react-reader.tsx
// 最小化示例：react-reader 基础用法 + CFI 定位跳转
// 来源: https://github.com/gerhardsletten/react-reader

import React, { useState, useRef } from "react";
import { ReactReader } from "react-reader";
import type { Rendition } from "epubjs";

function EpubViewer({ url }: { url: string }) {
  const [location, setLocation] = useState<string | number>(0);
  const renditionRef = useRef<Rendition | null>(null);

  // 跳转到指定 CFI 位置（供 Citation 跳转调用）
  const goToCfi = (cfi: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(cfi);
    }
  };

  return (
    <div style={{ height: "100vh" }}>
      <ReactReader
        url={url}                          // epub 文件路径或 URL
        location={location}                // 当前位置（CFI 字符串或页码）
        locationChanged={(loc: string) => setLocation(loc)}
        getRendition={(rendition: Rendition) => {
          renditionRef.current = rendition;
          // 可在这里自定义样式
          rendition.themes.default({
            body: {
              "font-family": "'Inter', sans-serif",
              "font-size": "18px",
              "line-height": "1.8",
              color: "#0f172a",
            },
          });
        }}
      />

      {/* 测试跳转按钮 */}
      <button onClick={() => goToCfi("epubcfi(/6/14!/4/2/1:0)")}>
        Jump to Chapter 23
      </button>
    </div>
  );
}

export default EpubViewer;
