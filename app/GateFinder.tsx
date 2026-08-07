"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Field = { key: string; group: string; label: string; order: number };
type CoreColumns = {
  location: string;
  project: string;
  name: string;
  aperture: string;
  head: string;
  operation: string;
  weight: string;
  designUnit: string | null;
  year: string | null;
};
type Core = {
  location: string;
  project: string;
  name: string;
  apertureRaw: string;
  aperture: string;
  width: number | null;
  height: number | null;
  headRaw: string;
  head: number | null;
  operation: string;
  weightRaw: string;
  weight: number | null;
  designUnit: string;
  year: string;
  quality: string;
  issues: string[];
};
type RecordItem = {
  id: string;
  sourceRow: number;
  sourceSerial: string;
  values: Record<string, string>;
  core: Core;
  searchText: string;
  score?: number;
};
type Era = {
  key: "after" | "before" | "unclassified";
  label: string;
  sheet: string;
  fields: Field[];
  coreColumns: CoreColumns;
  records: RecordItem[];
};
type CategoryData = {
  slug: string;
  label: string;
  kind: "flat-slide" | "flat-wheel" | "radial" | "trash";
  sourceFile: string;
  eras: Era[];
};
type Manifest = {
  total: number;
  categories: Array<{ slug: string; label: string; kind: string; count: number }>;
};

const DEFAULT_TARGET = { width: "6", height: "7", head: "35" };
const DEFAULT_TOLERANCE = { width: 15, height: 15, head: 15 };
const SURFACE_GATE_SLUGS = new Set(["surface-slide", "surface-wheel", "surface-radial"]);
const SUBMERGED_GATE_SLUGS = new Set(["submerged-slide", "submerged-wheel", "submerged-radial"]);
type AxisKey = keyof typeof DEFAULT_TARGET;
type ToleranceMode = "percent" | "range";
type DirectRange = { min: string; max: string };

const DEFAULT_TOLERANCE_MODE: Record<AxisKey, ToleranceMode> = {
  width: "percent",
  height: "percent",
  head: "percent",
};

const DEFAULT_DIRECT_RANGE: Record<AxisKey, DirectRange> = {
  width: { min: "5.1", max: "6.9" },
  height: { min: "6", max: "8.1" },
  head: { min: "29.8", max: "40.3" },
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function rangeOf(value: number, tolerance: number) {
  return {
    min: round1(value * (1 - tolerance / 100)),
    max: round1(value * (1 + tolerance / 100)),
  };
}

function numericOcr(value: string) {
  return value
    .trim()
    .replace(/[Iil|]/g, "1")
    .replace(/[Oo]/g, "0")
    .replace(/[Xx*]/g, "×")
    .replace(/(?<=[\d.×])[Ss](?=[\d.×])/g, "5");
}

function parseDimension(value: string) {
  const normalized = numericOcr(value);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)/);
  return match
    ? { width: Number(match[1]), height: Number(match[2]), aperture: normalized }
    : null;
}

function parseNumberMax(value: string) {
  const normalized = numericOcr(value);
  if (normalized.includes("×")) return null;
  const values = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return values.length ? Math.max(...values) : null;
}

function parseNumberFirst(value: string) {
  const found = numericOcr(value).match(/\d+(?:\.\d+)?/);
  return found ? Number(found[0]) : null;
}

function applyOverrides(
  record: RecordItem,
  era: Era,
  overrides: Record<string, string>,
) {
  const values = { ...record.values };
  for (const field of era.fields) {
    const key = `${record.id}:${field.key}`;
    if (key in overrides) values[field.key] = overrides[key];
  }
  const apertureRaw = values[era.coreColumns.aperture] ?? "";
  const dimension = parseDimension(apertureRaw);
  const headRaw = values[era.coreColumns.head] ?? "";
  const weightRaw = values[era.coreColumns.weight] ?? "";
  const core: Core = {
    ...record.core,
    location: values[era.coreColumns.location] ?? "",
    project: values[era.coreColumns.project] ?? "",
    name: values[era.coreColumns.name] ?? "",
    apertureRaw,
    aperture: dimension?.aperture ?? apertureRaw.replace(/[Xx*]/g, "×"),
    width: dimension?.width ?? null,
    height: dimension?.height ?? null,
    headRaw,
    head: parseNumberMax(headRaw),
    operation: values[era.coreColumns.operation] ?? "",
    weightRaw,
    weight: parseNumberFirst(weightRaw),
    designUnit: era.coreColumns.designUnit
      ? values[era.coreColumns.designUnit] ?? ""
      : "",
    year: era.coreColumns.year ? values[era.coreColumns.year] ?? "" : "",
  };
  const searchText = Object.values(values).join(" ").toLowerCase();
  return { ...record, values, core, searchText };
}

function formatNumber(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function fieldFor(era: Era, group: string, label: string) {
  return era.fields.find((field) => field.group === group && field.label === label);
}

function statsOf(records: RecordItem[]) {
  const weights = records
    .map((record) => record.core.weight)
    .filter((value): value is number => value !== null && value >= 0)
    .sort((a, b) => a - b);
  if (!weights.length) return { count: 0, average: null, median: null, min: null, max: null };
  const middle = Math.floor(weights.length / 2);
  return {
    count: weights.length,
    average: weights.reduce((sum, value) => sum + value, 0) / weights.length,
    median:
      weights.length % 2 ? weights[middle] : (weights[middle - 1] + weights[middle]) / 2,
    min: weights[0],
    max: weights[weights.length - 1],
  };
}

function toleranceMatch(value: number | null, target: number, tolerance: number) {
  if (!target) return true;
  if (value === null) return false;
  const range = rangeOf(target, tolerance);
  return value >= range.min && value <= range.max;
}

function directRangeMatch(value: number | null, range: DirectRange) {
  if (!range.min.trim() && !range.max.trim()) return true;
  if (value === null) return false;
  const min = range.min.trim() ? Number(range.min) : -Infinity;
  const max = range.max.trim() ? Number(range.max) : Infinity;
  if (Number.isNaN(min) || Number.isNaN(max)) return false;
  return value >= Math.min(min, max) && value <= Math.max(min, max);
}

function ToleranceControl({
  label,
  value,
  target,
  unit,
  mode,
  directRange,
  onChange,
  onModeChange,
  onRangeChange,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  mode: ToleranceMode;
  directRange: DirectRange;
  onChange: (value: number) => void;
  onModeChange: (mode: ToleranceMode) => void;
  onRangeChange: (range: DirectRange) => void;
}) {
  const range = rangeOf(target || 0, value);
  return (
    <div className={`tolerance-item ${target ? "" : "inactive"}`}>
      <div className="tolerance-head">
        <span>{label}</span>
        <div className="mode-switch" aria-label={`${label}方式`}>
          <button type="button" className={mode === "percent" ? "active" : ""} onClick={() => onModeChange("percent")}>百分比</button>
          <button type="button" className={mode === "range" ? "active" : ""} onClick={() => onModeChange("range")}>输入范围</button>
        </div>
      </div>
      {mode === "percent" ? (
        <>
          <div className="slider-line">
            <input
              aria-label={`${label}百分比`}
              type="range"
              min="0"
              max="50"
              step="1"
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
            />
            <strong>±{value}%</strong>
          </div>
          <div className="tolerance-foot">
            <span>精确</span>
            <b>{target ? `${range.min}～${range.max} ${unit}` : "目标已清空，此项不限"}</b>
            <span>宽松</span>
          </div>
        </>
      ) : (
        <div className="direct-range">
          <label><span>下限</span><input inputMode="decimal" placeholder="不限" value={directRange.min} onChange={(event) => onRangeChange({ ...directRange, min: event.target.value })} /></label>
          <i>～</i>
          <label><span>上限</span><input inputMode="decimal" placeholder="不限" value={directRange.max} onChange={(event) => onRangeChange({ ...directRange, max: event.target.value })} /></label>
          <b>{unit}</b>
        </div>
      )}
    </div>
  );
}

function WeightHistogram({ records }: { records: RecordItem[] }) {
  const weights = records
    .map((record) => record.core.weight)
    .filter((value): value is number => value !== null && value >= 0);
  if (weights.length < 2) return <div className="chart-empty">有效重量不足，暂不绘图</div>;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const binCount = 12;
  const step = max === min ? 1 : (max - min) / binCount;
  const bins = Array.from({ length: binCount }, () => 0);
  for (const weight of weights) {
    const index = Math.min(binCount - 1, Math.floor((weight - min) / step));
    bins[index] += 1;
  }
  const tallest = Math.max(...bins);
  return (
    <div className="histogram" aria-label="重量分布图">
      <div className="bars">
        {bins.map((count, index) => (
          <div className="bar-slot" key={index} title={`${count} 条`}>
            <div className="bar" style={{ height: `${Math.max(5, (count / tallest) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-axis">
        <span>{formatNumber(min)} t</span>
        <span>闸门总自重分布</span>
        <span>{formatNumber(max)} t</span>
      </div>
    </div>
  );
}

export function GateFinder() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("submerged-slide");
  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [toleranceMode, setToleranceMode] = useState<Record<AxisKey, ToleranceMode>>(DEFAULT_TOLERANCE_MODE);
  const [directRange, setDirectRange] = useState<Record<AxisKey, DirectRange>>(DEFAULT_DIRECT_RANGE);
  const [sort, setSort] = useState("similarity");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{ era: Era; record: RecordItem } | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [batchEra, setBatchEra] = useState<Era | null>(null);
  const [batchField, setBatchField] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState<Record<string, number>>({ after: 1, before: 1, unclassified: 1 });
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/data/manifest.json").then((response) => response.json()).then(setManifest);
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setData(null);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/data/${selectedSlug}.json`).then((response) => response.json()),
      fetch(`/api/overrides?prefix=${selectedSlug}-`)
        .then((response) => (response.ok ? response.json() : { overrides: [] }))
        .catch(() => ({ overrides: [] })),
    ]).then(([category, saved]) => {
      setData(category);
      const map: Record<string, string> = {};
      for (const item of saved.overrides ?? []) {
        map[`${item.record_id}:${item.field_key}`] = item.value;
      }
      setOverrides(map);
      setLoading(false);
      setSelected(null);
      setExpandedTables({});
    });
  }, [selectedSlug]);

  useEffect(() => {
    setPage({ after: 1, before: 1, unclassified: 1 });
  }, [keyword, selectedSlug, sort, target.head, target.height, target.width, tolerance.head, tolerance.height, tolerance.width, toleranceMode.head, toleranceMode.height, toleranceMode.width, directRange.head.min, directRange.head.max, directRange.height.min, directRange.height.max, directRange.width.min, directRange.width.max]);

  const targets = {
    width: Number(target.width) || 0,
    height: Number(target.height) || 0,
    head: Number(target.head) || 0,
  };

  function changeToleranceMode(axis: AxisKey, mode: ToleranceMode) {
    if (mode === "range" && target[axis]) {
      const next = rangeOf(Number(target[axis]), tolerance[axis]);
      setDirectRange((current) => ({
        ...current,
        [axis]: { min: String(next.min), max: String(next.max) },
      }));
    }
    setToleranceMode((current) => ({ ...current, [axis]: mode }));
  }

  function clearLimit(axis: AxisKey) {
    setTarget((current) => ({ ...current, [axis]: "" }));
    setDirectRange((current) => ({ ...current, [axis]: { min: "", max: "" } }));
  }

  function selectCategory(slug: string) {
    setSelectedSlug(slug);
    if (SURFACE_GATE_SLUGS.has(slug)) {
      clearLimit("head");
    } else if (SUBMERGED_GATE_SLUGS.has(slug)) {
      const defaultHead = Number(DEFAULT_TARGET.head);
      const defaultRange = rangeOf(defaultHead, tolerance.head);
      setTarget((current) => ({ ...current, head: DEFAULT_TARGET.head }));
      setDirectRange((current) => ({
        ...current,
        head: { min: String(defaultRange.min), max: String(defaultRange.max) },
      }));
    }
  }

  const results = useMemo(() => {
    if (!data) return [];
    return data.eras.map((era) => {
      const matchesAxis = (value: number | null, axis: AxisKey) => {
        if (!target[axis].trim()) return true;
        return toleranceMode[axis] === "range"
          ? directRangeMatch(value, directRange[axis])
          : toleranceMatch(value, targets[axis], tolerance[axis]);
      };
      const filtered = era.records
        .map((record) => applyOverrides(record, era, overrides))
        .filter((record) => {
          if (keyword.trim() && !record.searchText.includes(keyword.trim().toLowerCase())) return false;
          if (!matchesAxis(record.core.width, "width")) return false;
          if (!matchesAxis(record.core.height, "height")) return false;
          if (data.kind !== "trash" && !matchesAxis(record.core.head, "head")) return false;
          return true;
        })
        .map((record) => {
          const parts = [
            targets.width && record.core.width !== null ? Math.abs(record.core.width - targets.width) / targets.width : 0,
            targets.height && record.core.height !== null ? Math.abs(record.core.height - targets.height) / targets.height : 0,
            data.kind !== "trash" && targets.head && record.core.head !== null
              ? Math.abs(record.core.head - targets.head) / targets.head
              : 0,
          ];
          return { ...record, score: parts.reduce((sum, value) => sum + value, 0) };
        });
      filtered.sort((a, b) => {
        if (sort === "weight-asc") return (a.core.weight ?? Infinity) - (b.core.weight ?? Infinity);
        if (sort === "weight-desc") return (b.core.weight ?? -Infinity) - (a.core.weight ?? -Infinity);
        if (sort === "head") return (b.core.head ?? -Infinity) - (a.core.head ?? -Infinity);
        return (a.score ?? 0) - (b.score ?? 0);
      });
      return { era, records: filtered };
    });
  }, [data, keyword, overrides, sort, target.head, target.height, target.width, tolerance.head, tolerance.height, tolerance.width, toleranceMode.head, toleranceMode.height, toleranceMode.width, directRange.head.min, directRange.head.max, directRange.height.min, directRange.height.max, directRange.width.min, directRange.width.max]);

  const allResults = results.flatMap((item) => item.records);
  const totalStats = statsOf(allResults);

  async function unlock() {
    setUnlockError("");
    const response = await fetch("/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: passwordDraft }),
    });
    if (!response.ok) {
      setUnlockError("密码不正确，请重试");
      return;
    }
    setEditPassword(passwordDraft);
    setPasswordDraft("");
    setUnlockOpen(false);
    setNotice("编辑已解锁，本次刷新前有效");
  }

  async function saveChanges(changes: Array<{ recordId: string; fieldKey: string; value: string }>) {
    const response = await fetch("/api/overrides", {
      method: "POST",
      headers: { "content-type": "application/json", "x-editor-password": editPassword },
      body: JSON.stringify({ changes }),
    });
    if (!response.ok) {
      setEditPassword("");
      setNotice("保存失败，编辑已重新锁定");
      return false;
    }
    setOverrides((current) => {
      const next = { ...current };
      for (const change of changes) next[`${change.recordId}:${change.fieldKey}`] = change.value;
      return next;
    });
    setNotice(`已保存 ${changes.length} 处修改`);
    return true;
  }

  const batchRecords = batchEra
    ? results.find((item) => item.era.key === batchEra.key)?.records ?? []
    : [];
  const batchChanges = batchField && findText
    ? batchRecords.flatMap((record) => {
        const current = record.values[batchField] ?? "";
        if (!current.includes(findText)) return [];
        return [{ recordId: record.id, fieldKey: batchField, value: current.split(findText).join(replaceText) }];
      })
    : [];

  return (
    <main>
      <header className="topbar">
        <Image className="brand-logo" src="/icons/logo.png" alt="金结闸典" width={34} height={34} priority />
        <div className="brand-copy">
          <strong>金结闸典</strong>
          <span>GATE ENGINEERING INDEX</span>
        </div>
        <div className="topbar-actions">
          <span className="data-count">收录 {manifest?.total?.toLocaleString("zh-CN") ?? "—"} 条</span>
          {editPassword ? (
            <button className="unlock unlocked" onClick={() => setEditPassword("")}>已解锁 · 点击锁定</button>
          ) : (
            <button className="unlock" onClick={() => setUnlockOpen(true)}>解锁编辑</button>
          )}
        </div>
      </header>

      <section className="search-panel">
        <div className="category-grid">
          {manifest?.categories.map((category) => (
            <button
              key={category.slug}
              className={selectedSlug === category.slug ? "category active" : "category"}
              onClick={() => selectCategory(category.slug)}
            >
              <span>{category.label}</span>
              <small>{category.count.toLocaleString("zh-CN")} 条资料</small>
            </button>
          ))}
        </div>
        <div className="parameter-row">
          <label><span className="parameter-caption"><span>孔口宽度</span><button type="button" disabled={!target.width} onClick={() => clearLimit("width")}>清空限制</button></span><div><input inputMode="decimal" placeholder="不限" value={target.width} onChange={(e) => setTarget({ ...target, width: e.target.value })} /><b>m</b></div></label>
          <span className="multiply">×</span>
          <label><span className="parameter-caption"><span>孔口高度</span><button type="button" disabled={!target.height} onClick={() => clearLimit("height")}>清空限制</button></span><div><input inputMode="decimal" placeholder="不限" value={target.height} onChange={(e) => setTarget({ ...target, height: e.target.value })} /><b>m</b></div></label>
          <span className="dash">—</span>
          <label className={`head-field ${data?.kind === "trash" ? "disabled" : ""}`}><span className="parameter-caption"><span>设计水头</span><button type="button" disabled={data?.kind === "trash" || !target.head} onClick={() => clearLimit("head")}>清空限制</button></span><div><input inputMode="decimal" placeholder="不限" disabled={data?.kind === "trash"} value={data?.kind === "trash" ? "不参与" : target.head} onChange={(e) => setTarget({ ...target, head: e.target.value })} /><b>m</b></div></label>
          <label className="keyword"><span>全字段关键词</span><div><input placeholder="地点、工程、材料、启闭机……" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div></label>
        </div>

        <div className="tolerance-guide">
          <div className="tolerance-grid">
            <ToleranceControl label="宽度容差" value={tolerance.width} target={targets.width} unit="m" mode={toleranceMode.width} directRange={directRange.width} onChange={(width) => setTolerance({ ...tolerance, width })} onModeChange={(mode) => changeToleranceMode("width", mode)} onRangeChange={(range) => setDirectRange({ ...directRange, width: range })} />
            <ToleranceControl label="高度容差" value={tolerance.height} target={targets.height} unit="m" mode={toleranceMode.height} directRange={directRange.height} onChange={(height) => setTolerance({ ...tolerance, height })} onModeChange={(mode) => changeToleranceMode("height", mode)} onRangeChange={(range) => setDirectRange({ ...directRange, height: range })} />
            {data?.kind !== "trash" && <ToleranceControl label="水头容差" value={tolerance.head} target={targets.head} unit="m" mode={toleranceMode.head} directRange={directRange.head} onChange={(head) => setTolerance({ ...tolerance, head })} onModeChange={(mode) => changeToleranceMode("head", mode)} onRangeChange={(range) => setDirectRange({ ...directRange, head: range })} />}
          </div>
          <button className="reset-tolerance" onClick={() => { setTolerance(DEFAULT_TOLERANCE); setToleranceMode(DEFAULT_TOLERANCE_MODE); }}>恢复默认 ±15%</button>
        </div>
      </section>

      {!selectedSlug ? (
        <section className="choose-empty"><span>↑</span><h2>请先选择一个设备分类</h2><p>选中后将载入真实工程资料，并按95年后、95年前分区显示。</p></section>
      ) : loading || !data ? (
        <section className="choose-empty"><div className="loader" /><h2>正在整理工程资料</h2></section>
      ) : (
        <section className="results-wrap">
          <div className="results-overview">
            <div><p>当前分类</p><h2>{data.label}</h2><span>{allResults.length.toLocaleString("zh-CN")} 条符合容差条件</span></div>
            <div className="metric"><span>平均总自重</span><strong>{formatNumber(totalStats.average)}<small> t</small></strong><p>有效样本 {totalStats.count} 条</p></div>
            <div className="metric"><span>中位总自重</span><strong>{formatNumber(totalStats.median)}<small> t</small></strong><p>{formatNumber(totalStats.min)}～{formatNumber(totalStats.max)} t</p></div>
            <div className="overview-chart"><WeightHistogram records={allResults} /></div>
          </div>
          {results.map(({ era, records }) => {
            const stats = statsOf(records);
            const pageSize = 100;
            const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
            const currentPage = Math.min(page[era.key] ?? 1, totalPages);
            const pageStart = (currentPage - 1) * pageSize;
            const hoistTypeField = fieldFor(era, "启闭机", "型式");
            const hoistCapacityField = era.fields.find((field) => field.group === "启闭机" && field.label.startsWith("容量"));
            const shownFieldKeys = new Set([
              era.coreColumns.project,
              era.coreColumns.name,
              era.coreColumns.aperture,
              era.coreColumns.weight,
              era.coreColumns.location,
              ...(data.kind === "trash" ? [] : [era.coreColumns.head, era.coreColumns.operation, hoistTypeField?.key, hoistCapacityField?.key]),
            ].filter((key): key is string => Boolean(key)));
            const extraFields = era.fields.filter((field) => !shownFieldKeys.has(field.key));
            const tableExpanded = Boolean(expandedTables[era.key]);
            return (
              <section className={`era-section era-${era.key}`} key={era.key}>
                <div className="era-heading">
                  <div><span>{era.key === "after" ? "新版字段" : era.key === "before" ? "历史字段" : "独立资料"}</span><h2>{era.label}</h2><p>{records.length.toLocaleString("zh-CN")} 条 · 平均总自重 {formatNumber(stats.average)} t · 中位数 {formatNumber(stats.median)} t</p></div>
                  <div className="era-actions">
                    {(era.key === "after" || (results.every((item) => item.era.key !== "after") && era.key === results[0]?.era.key)) && (
                      <label className="era-sort">排序方式<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="similarity">参数最接近</option><option value="weight-asc">重量由轻到重</option><option value="weight-desc">重量由重到轻</option><option value="head">水头由高到低</option></select></label>
                    )}
                    {editPassword && <button className="batch-button" onClick={() => { setBatchEra(era); setBatchField(era.fields[0]?.key ?? ""); }}>在本表查找替换</button>}
                  </div>
                </div>
                <div className="table-shell">
                  <table className={tableExpanded ? "expanded-table" : ""}>
                    <thead><tr><th>工程名称</th><th>设备名称</th><th>孔口尺寸</th>{data.kind !== "trash" && <th>设计水头</th>}<th>总自重</th>{data.kind !== "trash" && <><th>操作方式</th><th>启闭机 · 型式</th><th>启闭机 · 容量</th></>}<th>所在地点</th>{tableExpanded && extraFields.map((field) => <th key={field.key} title={field.group}>{field.group} · {field.label}</th>)}<th /></tr></thead>
                    <tbody>
                      {records.slice(pageStart, pageStart + pageSize).map((record) => (
                        <tr key={record.id} onClick={() => setSelected({ era, record })}>
                          <td title={record.core.project}>{record.core.project || "—"}</td><td title={record.core.name}>{record.core.name || "—"}</td><td className="numeric">{record.core.aperture || "—"}</td>{data.kind !== "trash" && <td className="numeric">{formatNumber(record.core.head)} m</td>}<td className="numeric weight">{formatNumber(record.core.weight)} t</td>{data.kind !== "trash" && <><td>{record.core.operation || "—"}</td><td>{hoistTypeField ? record.values[hoistTypeField.key] || "—" : "—"}</td><td>{hoistCapacityField ? record.values[hoistCapacityField.key] || "—" : "—"}</td></>}<td className="location-cell" title={record.core.location}>{record.core.location || "—"}</td>{tableExpanded && extraFields.map((field) => <td className="raw-field" title={record.values[field.key] ?? ""} key={field.key}>{record.values[field.key] || "—"}</td>)}<td><button className="detail-link" onClick={(event) => { event.stopPropagation(); setExpandedTables((current) => ({ ...current, [era.key]: !tableExpanded })); }}>{tableExpanded ? "收起资料 ‹" : "完整资料 ›"}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!records.length && <div className="no-results"><strong>这个筛选范围内没有记录</strong><span>放宽容差或输入范围，或调整目标参数后再看。</span></div>}
                </div>
                {records.length > 0 && <div className="pagination"><span>第 {currentPage} / {totalPages} 页 · 每页最多100条</span><div><button disabled={currentPage <= 1} onClick={() => setPage({ ...page, [era.key]: currentPage - 1 })}>上一页</button><button disabled={currentPage >= totalPages} onClick={() => setPage({ ...page, [era.key]: currentPage + 1 })}>下一页</button></div></div>}
              </section>
            );
          })}
        </section>
      )}

      <footer><strong>金结闸典</strong><span>数据来自新版水利水电特性表，存在OCR错误请复核使用。网站问题联系<a href="https://applink.feishu.cn/client/chat/open?openId=ou_ef4ffc00013739a64798ce655b5dd002" target="_blank" rel="noreferrer">秦方</a>。</span></footer>

      {notice && <button className="notice" onClick={() => setNotice("")}>{notice}</button>}

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head"><div><span>{data?.label} · {selected.era.label}</span><h2>{selected.record.core.project || selected.record.core.name || "设备完整资料"}</h2><p>来源：{data?.sourceFile} / {selected.era.sheet} / 第 {selected.record.sourceRow} 行</p></div><button onClick={() => setSelected(null)}>关闭</button></div>
            {selected.record.core.issues.length > 0 && <div className="issue-box"><strong>数据提示</strong><span>{selected.record.core.issues.join("；")}</span></div>}
            {Array.from(new Set(selected.era.fields.map((field) => field.group))).map((group) => (
              <section className="detail-group" key={group}><h3>{group}</h3><div className="detail-grid">
                {selected.era.fields.filter((field) => field.group === group).map((field) => (
                  <EditableField key={field.key} field={field} record={selected.record} unlocked={Boolean(editPassword)} onSave={(value) => saveChanges([{ recordId: selected.record.id, fieldKey: field.key, value }])} />
                ))}
              </div></section>
            ))}
          </aside>
        </div>
      )}

      {unlockOpen && (
        <div className="modal-backdrop"><div className="modal"><span className="modal-kicker">编辑权限</span><h2>解锁资料修改</h2><p>解锁后可以修改设备字段，并对当前筛选表执行批量查找替换。</p><input autoFocus type="password" value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="输入编辑密码" />{unlockError && <span className="form-error">{unlockError}</span>}<div className="modal-actions"><button onClick={() => setUnlockOpen(false)}>取消</button><button className="primary" onClick={unlock}>解锁</button></div></div></div>
      )}

      {batchEra && (
        <div className="modal-backdrop"><div className="modal batch-modal"><span className="modal-kicker">{batchEra.label} · 当前筛选结果</span><h2>查找并批量替换</h2><label>目标字段<select value={batchField} onChange={(e) => setBatchField(e.target.value)}>{batchEra.fields.map((field) => <option value={field.key} key={field.key}>{field.group} / {field.label}</option>)}</select></label><div className="replace-grid"><label>查找内容<input value={findText} onChange={(e) => setFindText(e.target.value)} /></label><label>替换为<input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} /></label></div><div className="preview-count"><strong>{batchChanges.length}</strong><span>个单元格将被修改</span></div><p className="batch-note">只作用于当前筛选结果和所选字段，不修改原始 Excel 文件。</p><div className="modal-actions"><button onClick={() => setBatchEra(null)}>取消</button><button className="primary" disabled={!batchChanges.length} onClick={async () => { if (await saveChanges(batchChanges)) { setBatchEra(null); setFindText(""); setReplaceText(""); } }}>确认替换</button></div></div></div>
      )}
    </main>
  );
}

function EditableField({ field, record, unlocked, onSave }: { field: Field; record: RecordItem; unlocked: boolean; onSave: (value: string) => Promise<boolean> }) {
  const current = record.values[field.key] ?? "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);
  return (
    <label className="detail-field"><span>{field.label}</span>{unlocked ? <div className="editable"><input value={draft} onChange={(e) => setDraft(e.target.value)} /><button disabled={draft === current} onClick={async () => { if (await onSave(draft)) record.values[field.key] = draft; }}>保存</button></div> : <p>{current || "—"}</p>}</label>
  );
}
