import { useEffect, useMemo, useState } from "react";
import SupportWidget from "./SupportWidget";
import OrderReceipt from "./OrderReceipt";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBars,
  faCheckCircle,
  faChevronRight,
  faHeart,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faShoppingBag,
  faShoppingCart,
  faStar,
  faTruckFast,
  faXmark,
  faBolt,
  faShieldHalved,
  faHeadphones,
} from "@fortawesome/free-solid-svg-icons";
import products from "./products";
import "./App.css";

const categories = [
  { name: "All Gadgets", icon: "✦" },
  { name: "Phones", icon: "▣" },
  { name: "Laptops", icon: "▱" },
  { name: "Audio", icon: "♫" },
  { name: "Wearables", icon: "◉" },
  { name: "Gaming", icon: "⌘" },
  { name: "Cameras", icon: "◎" },
  { name: "Accessories", icon: "⌁" },
];

const money = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

function App() {
  const [category, setCategory] = useState("All Gadgets");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "All Gadgets" || product.category === category;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  function addToCart(product) {
    if (product.stock < 1) {
      setNotice("This product is currently out of stock.");
      return;
    }

    setCart((current) => {
      const found = current.find((item) => item.id === product.id);

      if (found) {
        if (found.quantity >= product.stock) return current;

        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    setNotice(`${product.name} added to your bag`);
    setCartOpen(true);
  }

  function updateQuantity(id, amount) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: Math.min(
                  item.stock,
                  Math.max(0, item.quantity + amount),
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function selectCategory(name) {
    setCategory(name);
    setMobileMenu(false);
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitOrder(event) {
    event.preventDefault();
    setOrderError("");

    if (!cart.length) {
      setOrderError("Your shopping bag is empty.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: cart.map(({ id, quantity }) => ({ id, quantity })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "We could not submit your order.");
      }

      setReceiptOrder({
  orderCode: result.orderCode || result.orderId,
  status: result.status || "pending",
  total: result.total ?? subtotal,
  items: cart.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    unitPrice: item.price,
    lineTotal: item.price * item.quantity,
  })),
});

setCart([]);
setCheckoutOpen(false);
setCartOpen(false);
setCustomer({
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
});

if (!result.emailSent) {
  setNotice(
    "Your order was saved, but the store email could not be sent. Please contact VintchGadget."
  );
}
      setNotice(
        `Order submitted successfully! Your order reference is ${result.orderId}.`,
      );
    } catch (error) {
      setOrderError(
        error.message ||
          "Unable to connect to the order service. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="store">
      <div className="announcement">
        <span className="announcement-spark">✦</span>
        YOUR NEXT TECH OBSESSION STARTS HERE
        <span className="announcement-right">
          DISCOVER SOMETHING NEW <FontAwesomeIcon icon={faArrowRight} />
        </span>
      </div>

      <header className="site-header">
        <a className="brand" href="#home" aria-label="VintchGadget home">
          <span className="brand-mark"><FontAwesomeIcon icon={faBolt} /></span>
          <span>
            <span className="brand-name">Vintch<span>Gadget</span></span>
            <span className="brand-tagline">TECH FOR YOUR WORLD</span>
          </span>
        </a>

        <nav className={`main-nav ${mobileMenu ? "nav-open" : ""}`}>
          <a href="#home" onClick={() => setMobileMenu(false)}>Home</a>
          <a href="#shop" onClick={() => setMobileMenu(false)}>Shop</a>
          <a href="#collections" onClick={() => setMobileMenu(false)}>Collections</a>
          <a href="#why-us" onClick={() => setMobileMenu(false)}>Why Vintch</a>
        </nav>

        <div className="header-actions">
          <label className="header-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
              }}
              placeholder="Find your next gadget..."
              aria-label="Search gadgets"
            />
            <kbd>⌕</kbd>
          </label>

          <button
            className="icon-button cart-trigger"
            onClick={() => setCartOpen(true)}
            aria-label="Open shopping cart"
          >
            <FontAwesomeIcon icon={faShoppingBag} />
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>

          <button
            className="icon-button mobile-menu-button"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle navigation"
          >
            <FontAwesomeIcon icon={mobileMenu ? faXmark : faBars} />
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <div className="eyebrow"><span /> THE FUTURE IS IN YOUR HANDS</div>
            <h1>
              Your world.
              <br />
              Your tech.
              <br />
              <span>Vintch.</span>
            </h1>
            <p>
              Discover gadgets that do more than keep up. From everyday
              essentials to next-level tech, find your next favourite here.
            </p>

            <div className="hero-buttons">
              <a className="button button-primary" href="#shop">
                Explore gadgets <FontAwesomeIcon icon={faArrowRight} />
              </a>
              <a className="button button-outline" href="#collections">
                Browse collections
              </a>
            </div>

            <div className="hero-proof">
              <div className="proof-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FontAwesomeIcon icon={faStar} key={star} />
                ))}
              </div>
              <span>Gadgets for every kind of life.</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-glow" />
            <div className="hero-floating-label label-top">
              <span className="live-dot" /> THE NEXT BIG THING
            </div>
            <img
              className="hero-product-image"
              src={products[0].image}
              alt="Featured gadget"
            />
            <div className="hero-product-caption">
              <span>CURATED TECH</span>
              <strong>Made for more.</strong>
            </div>
            <div className="hero-float-card float-card-top">
              <span className="float-icon"><FontAwesomeIcon icon={faBolt} /></span>
              <span><strong>Next-level tech</strong><small>Everyday innovation</small></span>
            </div>
            <div className="hero-float-card float-card-bottom">
              <span className="float-check"><FontAwesomeIcon icon={faCheckCircle} /></span>
              <span><strong>Find your favourite</strong><small>Your next upgrade awaits</small></span>
            </div>
            <span className="hero-decoration">V / 01</span>
          </div>
        </section>

        <section className="marquee-section" aria-label="Gadget showcase">
          <div className="marquee-heading">
            <span>THE GADGET LINEUP</span>
            <span>SCROLLING INTO YOUR WORLD ↗</span>
          </div>
          <div className="marquee-window">
            <div className="marquee-track">
              {[...products, ...products].map((product, index) => (
                <button
                  className="marquee-item"
                  key={`${product.id}-${index}`}
                  onClick={() => addToCart(product)}
                  aria-label={`Add ${product.name} to cart`}
                >
                  <img src={product.image} alt="" loading="lazy" />
                  <span className="marquee-item-copy">
                    <strong>{product.name}</strong>
                    <small>{product.category}</small>
                  </span>
                  <span className="marquee-plus"><FontAwesomeIcon icon={faPlus} /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="category-section section-wrap" id="collections">
          <div className="section-heading">
            <div>
              <span className="section-kicker">FIND YOUR FREQUENCY</span>
              <h2>Explore the <span>universe.</span></h2>
            </div>
            <p>Whatever you’re into, there’s a gadget for that.</p>
          </div>

          <div className="category-grid">
            {categories.map((item, index) => (
              <button
                className={`category-card ${category === item.name ? "category-active" : ""}`}
                key={item.name}
                onClick={() => selectCategory(item.name)}
                style={{ "--card-index": index }}
              >
                <span className="category-symbol">{item.icon}</span>
                <span className="category-name">{item.name}</span>
                <span className="category-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="shop-section section-wrap" id="shop">
          <div className="section-heading shop-heading">
            <div>
              <span className="section-kicker">THE GOOD STUFF</span>
              <h2>Gadgets worth <span>geeking out over.</span></h2>
            </div>
            <span className="product-total">
              {filteredProducts.length} PRODUCTS
            </span>
          </div>

          <div className="shop-toolbar">
            <div className="category-pills">
              {categories.map((item) => (
                <button
                  key={item.name}
                  className={category === item.name ? "pill-active" : ""}
                  onClick={() => setCategory(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            {search && (
              <button className="clear-search" onClick={() => setSearch("")}>
                Clear search <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>

          {filteredProducts.length ? (
            <div className="product-grid">
              {filteredProducts.map((product, index) => (
                <article
                  className="product-card"
                  key={product.id}
                  style={{ "--card-index": index }}
                >
                  <div className="product-image-wrap">
                    <img
                      className="product-image"
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                    />
                    <span className="product-badge">{product.badge}</span>
                    <button
                      className="wishlist-button"
                      onClick={() => setNotice(`${product.name} is one to remember!`)}
                      aria-label={`Save ${product.name}`}
                    >
                      <FontAwesomeIcon icon={faHeart} />
                    </button>
                    <button
                      className="quick-add"
                      onClick={() => addToCart(product)}
                      disabled={product.stock < 1}
                    >
                      <FontAwesomeIcon icon={faShoppingBag} />
                      {product.stock < 1 ? "Out of stock" : "Add to bag"}
                    </button>
                  </div>
                  <div className="product-info">
                    <div className="product-meta">
                      <span>{product.category}</span>
                      <span className="product-rating">
                        <FontAwesomeIcon icon={faStar} /> {product.rating}
                      </span>
                    </div>
                    <h3>{product.name}</h3>
                    <p className="product-description">{product.description}</p>
                    <div className="product-price-row">
                      <strong>{money(product.price)}</strong>
                      {product.oldPrice > product.price && (
                        <del>{money(product.oldPrice)}</del>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-products">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <h3>No gadgets found</h3>
              <p>Try another search or explore all our collections.</p>
              <button
                className="button button-primary"
                onClick={() => {
                  setSearch("");
                  setCategory("All Gadgets");
                }}
              >
                Show all gadgets
              </button>
            </div>
          )}
        </section>

        <section className="promo-section section-wrap">
          <div className="promo-copy">
            <span className="section-kicker">YOUR NEXT UPGRADE</span>
            <h2>Good tech.<br /><span>Better everyday.</span></h2>
            <p>Make room for the devices that make your world work better.</p>
            <a className="button button-light" href="#shop">
              Find your next gadget <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </div>
          <div className="promo-art">
            <div className="promo-ring" />
            <img src={products[2].image} alt="Wireless headphones" loading="lazy" />
            <div className="promo-sticker">TECH<br />YOUR<br />WAY ↗</div>
          </div>
        </section>

        <section className="benefits-section section-wrap" id="why-us">
          <div className="section-heading">
            <div>
              <span className="section-kicker">THE VINTCH DIFFERENCE</span>
              <h2>Shopping tech, <span>made easy.</span></h2>
            </div>
          </div>
          <div className="benefit-grid">
            <div className="benefit-card">
              <span><FontAwesomeIcon icon={faTruckFast} /></span>
              <h3>Delivery details upfront</h3>
              <p>Provide your delivery address at checkout so your order can be arranged.</p>
            </div>
            <div className="benefit-card">
              <span><FontAwesomeIcon icon={faShieldHalved} /></span>
              <h3>Clear order records</h3>
              <p>Your submitted order details are sent to our store admin for processing.</p>
            </div>
            <div className="benefit-card">
              <span><FontAwesomeIcon icon={faHeadphones} /></span>
              <h3>Here for your questions</h3>
              <p>Contact our team at vintchgadget@gmail.com 2348167355014 for product enquiries.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark"><FontAwesomeIcon icon={faBolt} /></span>
          <span>
            <span className="brand-name">Vintch<span>Gadget</span></span>
            <span className="brand-tagline">TECH FOR YOUR WORLD</span>
          </span>
        </a>
        <p>Find the tech that moves you.</p>
        <a href="mailto:vintchgadget@gmail.com">vintchgadget@gmail.com</a>
        <span className="footer-copy">© {new Date().getFullYear()} VintchGadget. All rights reserved.</span>
      </footer>

      {notice && (
        <div className="toast" role="status">
          <FontAwesomeIcon icon={faCheckCircle} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss notification">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCartOpen(false);
        }}>
          <aside className="cart-drawer" aria-label="Shopping bag">
            <div className="drawer-header">
              <div>
                <span className="section-kicker">YOUR SELECTION</span>
                <h2>Your bag <span>({cartCount})</span></h2>
              </div>
              <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close cart">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {cart.length ? (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <img src={item.image} alt={item.name} />
                      <div className="cart-item-details">
                        <span>{item.category}</span>
                        <strong>{item.name}</strong>
                        <b>{money(item.price)}</b>
                        <div className="quantity-control">
                          <button onClick={() => updateQuantity(item.id, -1)} aria-label="Decrease quantity">
                            <FontAwesomeIcon icon={faMinus} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label="Increase quantity"
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        </div>
                      </div>
                      <button className="remove-item" onClick={() => updateQuantity(item.id, -item.quantity)} aria-label={`Remove ${item.name}`}>
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                  <p>Delivery costs and arrangements will be confirmed with you.</p>
                  <button className="button button-primary checkout-button" onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                    setOrderError("");
                  }}>
                    Continue to checkout <FontAwesomeIcon icon={faArrowRight} />
                  </button>
                  <button className="continue-shopping" onClick={() => setCartOpen(false)}>
                    Continue shopping <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-cart">
                <span><FontAwesomeIcon icon={faShoppingCart} /></span>
                <h3>Your bag is taking a break.</h3>
                <p>Find something you love and add it to your bag.</p>
                <button className="button button-primary" onClick={() => setCartOpen(false)}>Explore gadgets</button>
              </div>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay checkout-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !sending) setCheckoutOpen(false);
        }}>
          <section className="checkout-modal" aria-label="Checkout">
            <div className="drawer-header">
              <div>
                <span className="section-kicker">ALMOST YOURS</span>
                <h2>Checkout <span>↗</span></h2>
              </div>
              <button className="icon-button" onClick={() => setCheckoutOpen(false)} disabled={sending} aria-label="Close checkout">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <p className="checkout-intro">Enter your details so we can receive and process your order.</p>

            <form className="checkout-form" onSubmit={submitOrder}>
              <label>
                Full name *
                <input required minLength={2} autoComplete="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Your full name" />
              </label>
              <div className="form-row">
                <label>
                  Email address *
                  <input required type="email" autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="you@example.com" />
                </label>
                <label>
                  Phone number *
                  <input required type="tel" autoComplete="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="+234..." />
                </label>
              </div>
              <label>
                Delivery address *
                <textarea required minLength={8} autoComplete="street-address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Enter your full delivery address" rows={3} />
              </label>
              <label>
                Order notes (optional)
                <textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="Any extra details?" rows={2} />
              </label>

              <div className="checkout-total">
                <span>Order subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <p className="checkout-disclaimer">Submitting sends your order request to VintchGadget. It does not process a payment or guarantee stock availability. We will contact you to confirm the order and delivery.</p>
              {orderError && <p className="form-error" role="alert">{orderError}</p>}
              <button className="button button-primary checkout-button" type="submit" disabled={sending || !cart.length}>
                {sending ? "Submitting order..." : <>Submit order <FontAwesomeIcon icon={faArrowRight} /></>}
              </button>
            </form>
          </section>
        </div>
      )}
      {receiptOrder && (
  <OrderReceipt
    order={receiptOrder}
    onClose={() => setReceiptOrder(null)}
  />
)}

<footer className="vg-store-footer">
  <div className="vg-footer-brand">
    <h2>VintchGadget<span>.</span></h2>
    <p>Your next favourite gadget is closer than you think.</p>
  </div>

  <div className="vg-footer-contact">
    <h3>Customer Support</h3>
    <p>Need help with an order, delivery, or product?</p>

    <a href="tel:08167355014">
      <span>Emergency line 1</span>
      <strong>2348167355014</strong>
    </a>

    <a href="tel:08155608499">
      <span>Emergency line 2</span>
      <strong>2348155608499</strong>
    </a>

    <a href="mailto:vintchgadget@gmail.com">
      <span>Email us</span>
      <strong>vintchgadget@gmail.com</strong>
    </a>
  </div>

  <div className="vg-footer-bottom">
    <span>© {new Date().getFullYear()} VintchGadget. All rights reserved.</span>
    <span>Here to help you shop with confidence.</span>
  </div>
</footer>

<SupportWidget />

    </div>
  );
}

export default App;
