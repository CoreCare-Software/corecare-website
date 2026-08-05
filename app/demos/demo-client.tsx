"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { PRODUCTS, type CoreCareProduct } from "../products";
import { Arrow } from "../site-chrome";
import { PRODUCT_DEMOS } from "./demo-data";

export default function DemoClient({ initialProductCode = "" }: { initialProductCode?: string }) {
  const initialProduct = PRODUCTS.find((product) => product.code === initialProductCode.toUpperCase() || product.slug.toUpperCase() === initialProductCode.toUpperCase()) || PRODUCTS[0];
  const [product, setProduct] = useState<CoreCareProduct>(initialProduct);
  const [viewIndex, setViewIndex] = useState(0);

  const demo = PRODUCT_DEMOS[product.code];
  const view = demo.views[viewIndex];

  function selectProduct(nextProduct: CoreCareProduct) {
    setProduct(nextProduct);
    setViewIndex(0);
    window.history.replaceState(null, "", `/demos?product=${nextProduct.code}`);
  }

  function moveProductTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % PRODUCTS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + PRODUCTS.length) % PRODUCTS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = PRODUCTS.length - 1;
    else return;
    event.preventDefault();
    selectProduct(PRODUCTS[next]);
    document.getElementById(`visual-product-${PRODUCTS[next].code}`)?.focus();
  }

  function moveViewTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % demo.views.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + demo.views.length) % demo.views.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = demo.views.length - 1;
    else return;
    event.preventDefault();
    setViewIndex(next);
    document.getElementById(`visual-view-${product.code}-${next}`)?.focus();
  }

  return <>
    <div className="visual-product-tabs" role="tablist" aria-label="Choose a CoreCare product demonstration">
      {PRODUCTS.map((item, index) => <button id={`visual-product-${item.code}`} type="button" role="tab" aria-selected={item.code === product.code} tabIndex={item.code === product.code ? 0 : -1} key={item.code} className={item.code === product.code ? "active" : ""} onKeyDown={(event) => moveProductTab(event, index)} onClick={() => selectProduct(item)} style={{ "--product-accent": item.accent, "--product-soft": item.soft } as React.CSSProperties}><i>{item.icon}</i><span>{item.shortName}<small>{item.eyebrow}</small></span></button>)}
    </div>

    <section className="visual-demo-intro" style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}>
      <div><p className="eyebrow">{product.eyebrow}</p><h2>{demo.promise}</h2><p>{demo.audience}</p></div>
      <div className="visual-view-tabs" role="tablist" aria-label={`${product.name} workflow views`}>
        {demo.views.map((item, index) => <button id={`visual-view-${product.code}-${index}`} type="button" role="tab" aria-selected={index === viewIndex} tabIndex={index === viewIndex ? 0 : -1} key={item.label} className={index === viewIndex ? "active" : ""} onKeyDown={(event) => moveViewTab(event, index)} onClick={() => setViewIndex(index)}><span>0{index + 1}</span>{item.label}</button>)}
      </div>
    </section>

    <div className="visual-workspace" role="tabpanel" aria-labelledby={`visual-view-${product.code}-${viewIndex}`} style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}>
      <aside className="visual-sidebar" aria-label={`Representative ${product.name} navigation`}><div className="visual-brand"><i>{product.icon}</i><span><strong>{product.shortName}</strong><small>Demo workspace</small></span></div><nav>{demo.nav.map((item, index) => <span className={index === viewIndex ? "active" : ""} key={item}><i aria-hidden="true">{index + 1}</i>{item}</span>)}</nav><div className="visual-user"><i>AR</i><span><strong>Alex Roberts</strong><small>Demo user</small></span></div></aside>
      <div className="visual-main">
        <header className="visual-topbar"><div><small>{product.name}</small><strong>{view.title}</strong></div><div className="visual-top-actions"><button type="button" aria-label="Representative notifications">2</button><span>Wednesday, 5 August</span></div></header>
        <div className="visual-content">
          <div className="visual-heading"><div><p>{view.description}</p></div><button type="button" onClick={() => setViewIndex((current) => (current + 1) % demo.views.length)}>{view.action}<span aria-hidden="true">+</span></button></div>
          <div className="visual-metrics">{view.metrics.map((metric) => <article key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.detail}</span></article>)}</div>
          <div className="visual-panels">
            <section className="visual-board"><header><div><strong>{view.boardTitle}</strong><small>{view.boardHint}</small></div><button type="button" aria-label={`More options for ${view.boardTitle}`}>•••</button></header><div>{view.rows.map((row, index) => <article key={row.title}><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{row.title}</strong><small>{row.meta}</small></span><em className={row.tone}>{row.status}</em></article>)}</div></section>
            <aside className="visual-activity"><header><strong>{view.activityTitle}</strong><span>Live</span></header>{view.activity.map((item) => <article key={`${item.time}-${item.title}`}><time>{item.time}</time><span><strong>{item.title}</strong><small>{item.detail}</small></span></article>)}</aside>
          </div>
        </div>
      </div>
    </div>

    <section className="visual-capabilities" aria-labelledby="capability-heading"><div><p className="eyebrow">Capability map</p><h2 id="capability-heading">What {product.shortName} brings together.</h2></div><div>{demo.capabilities.map((capability, index) => <article key={capability.title}><span>0{index + 1}</span><h3>{capability.title}</h3><p>{capability.detail}</p></article>)}</div></section>

    <div className="visual-demo-actions"><div><strong>Representative demonstration</strong><p>No live customer records are used. Exact production scope and integrations are confirmed during onboarding.</p></div>{product.trialAvailable ? <Link className="button" href={`/trial?product=${product.code}`}>Request a 30-day trial <Arrow /></Link> : <Link className="secondary-button" href="/contact">Ask about CoreCare operations <Arrow /></Link>}</div>
  </>;
}
