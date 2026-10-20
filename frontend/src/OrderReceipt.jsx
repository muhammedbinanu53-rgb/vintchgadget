
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faClock,
  faReceipt,
  faTruckFast,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import "./OrderReceipt.css";

const money = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

export default function OrderReceipt({ order, onClose }) {
  const [status, setStatus] = useState(order.status || "pending");
  const [details, setDetails] = useState(order);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const response = await fetch(
          `http://localhost:5000/api/orders/${encodeURIComponent(order.orderCode)}/status`
        );

        if (!response.ok) return;

        const result = await response.json();
        if (!active) return;

        setStatus(result.status);
        setDetails((current) => ({ ...current, ...result }));
      } catch {
        // Keep showing the last known status if temporarily offline.
      }
    }

    checkStatus();
    const timer = window.setInterval(checkStatus, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [order.orderCode]);

  const accepted = status === "accepted";
  const items = details.items || [];

  return (
    <div className="receipt-backdrop" role="presentation">
      <section
        className={`order-receipt ${accepted ? "receipt-accepted" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <button
          className="receipt-close"
          onClick={onClose}
          aria-label="Close receipt"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className="receipt-status-icon">
          <FontAwesomeIcon icon={accepted ? faCheck : faClock} />
        </div>

        <span className="receipt-kicker">
          VINTCHGADGET · ORDER RECEIPT
        </span>

        <h2 id="receipt-title">
          {accepted ? "Order Accepted" : "Order submitted successfully"}
        </h2>

        <p className="receipt-description">
          {accepted
            ? "Great news! VintchGadget has accepted your order."
            : "Your order has been received and is waiting for admin acceptance."}
        </p>

        <div className="receipt-code-panel">
          <span>YOUR ORDER NUMBER</span>
          <strong>{details.orderCode}</strong>
          <p>Keep this number safe. Your delivery person may ask for it.</p>
        </div>

        <div className="receipt-payment">
          <FontAwesomeIcon icon={faTruckFast} />
          <div>
            <strong>Payment on delivery</strong>
            <span>Pay when your order is delivered.</span>
          </div>
        </div>

        <div className="receipt-items">
          <h3>
            <FontAwesomeIcon icon={faReceipt} /> Order summary
          </h3>

          {items.map((item, index) => (
            <div className="receipt-item" key={`${item.name}-${index}`}>
              <span>
                {item.name} <small>× {item.quantity}</small>
              </span>
              <strong>{money(item.lineTotal ?? item.price * item.quantity)}</strong>
            </div>
          ))}

          <div className="receipt-total">
            <span>Subtotal</span>
            <strong>{money(details.total)}</strong>
          </div>
        </div>

        <div className="receipt-status-note">
          <span className="receipt-status-dot" />
          {accepted
            ? "Confirmed by the VintchGadget team"
            : "Waiting for the VintchGadget team"}
        </div>

        <button className="receipt-done" onClick={onClose}>
          Continue shopping
        </button>
      </section>
    </div>
  );
}
