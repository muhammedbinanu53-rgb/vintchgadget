
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeadset,
  faPhone,
  faEnvelope,
  faXmark,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import "./SupportWidget.css";

const supportContacts = [
  { number: "08167355014", label: "Emergency line 1" },
  { number: "08155608499", label: "Emergency line 2" },
];

export default function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="vg-support-float"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close support contacts" : "Open support contacts"}
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={open ? faXmark : faHeadset} />
        <span>{open ? "Close" : "Need help?"}</span>
      </button>

      {open && (
        <section className="vg-support-panel" aria-label="Customer support">
          <div className="vg-support-heading">
            <div className="vg-support-icon">
              <FontAwesomeIcon icon={faHeadset} />
            </div>
            <div>
              <strong>We're here to help</strong>
              <p>VintchGadget Customer Support</p>
            </div>
            <button
              className="vg-support-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <p className="vg-support-intro">
            Need help with a product, delivery, or an order? Contact us using
            one of the options below.
          </p>

          {supportContacts.map((contact) => (
            <a
              className="vg-support-contact"
              href={`tel:${contact.number}`}
              key={contact.number}
            >
              <span className="vg-support-contact-icon">
                <FontAwesomeIcon icon={faPhone} />
              </span>
              <span className="vg-support-contact-text">
                <small>{contact.label}</small>
                <strong>{contact.number}</strong>
              </span>
              <FontAwesomeIcon
                className="vg-support-arrow"
                icon={faArrowUpRightFromSquare}
              />
            </a>
          ))}

          <a
            className="vg-support-email"
            href="mailto:vintchgadget@gmail.com?subject=VintchGadget%20Customer%20Support"
          >
            <FontAwesomeIcon icon={faEnvelope} />
            <span>
              <small>Email support</small>
              <strong>vintchgadget@gmail.com</strong>
            </span>
          </a>

          <p className="vg-support-footnote">
            When contacting us about an order, please include your order code.
          </p>
        </section>
      )}
    </>
  );
}
