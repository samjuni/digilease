;; PropertyRegistry.clar
;; Clarity v2
;; Verifies and records ownership of rental properties to prevent fraudulent listings

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-REGISTERED u101)
(define-constant ERR-NOT-FOUND u102)
(define-constant ERR-INVALID-PROPERTY u103)
(define-constant ERR-ZERO-ADDRESS u104)
(define-constant ERR-INVALID-STATUS u105)
(define-constant ERR-ALREADY-VERIFIED u106)

;; Status enum
(define-constant STATUS-PENDING u0)
(define-constant STATUS-VERIFIED u1)
(define-constant STATUS-SUSPENDED u2)

;; Data structures
(define-data-var admin principal tx-sender)
(define-data-var verification-fee uint u1000) ;; Fee in microSTX for verification

(define-map properties
  { property-id: uint }
  {
    owner: principal,
    address: (string-utf8 256),
    description: (string-utf8 512),
    status: uint,
    registered-at: uint,
    verified-at: (optional uint)
  }
)

(define-map property-counter principal uint)

;; Private helpers
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (is-property-owner (property-id uint) (caller principal))
  (let
    (
      (property (unwrap! (map-get? properties { property-id: property-id }) (err ERR-NOT-FOUND)))
    )
    (is-eq caller (get owner property))
  )
)

;; Admin functions
(define-public (set-verification-fee (fee uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> fee u0) (err ERR-INVALID-PROPERTY))
    (var-set verification-fee fee)
    (ok true)
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Register property
(define-public (register-property (address (string-utf8 256)) (description (string-utf8 512)))
  (let
    (
      (owner tx-sender)
      (property-id (+ (default-to u0 (map-get? property-counter owner)) u1))
    )
    (asserts! (is-none (map-get? properties { property-id: property-id })) (err ERR-ALREADY-REGISTERED))
    (map-set properties
      { property-id: property-id }
      {
        owner: owner,
        address: address,
        description: description,
        status: STATUS-PENDING,
        registered-at: block-height,
        verified-at: none
      }
    )
    (map-set property-counter owner property-id)
    (ok property-id)
  )
)

;; Verify property
(define-public (verify-property (property-id uint))
  (let
    (
      (property (unwrap! (map-get? properties { property-id: property-id }) (err ERR-NOT-FOUND)))
    )
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status property) STATUS-PENDING) (err ERR-INVALID-STATUS))
    (try! (stx-transfer? (var-get verification-fee) tx-sender (as-contract tx-sender)))
    (map-set properties
      { property-id: property-id }
      (merge property { status: STATUS-VERIFIED, verified-at: (some block-height) })
    )
    (ok true)
  )
)

;; Suspend property
(define-public (suspend-property (property-id uint))
  (let
    (
      (property (unwrap! (map-get? properties { property-id: property-id }) (err ERR-NOT-FOUND)))
    )
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status property) STATUS-VERIFIED) (err ERR-INVALID-STATUS))
    (map-set properties
      { property-id: property-id }
      (merge property { status: STATUS-SUSPENDED })
    )
    (ok true)
  )
)

;; Transfer property ownership
(define-public (transfer-property (property-id uint) (new-owner principal))
  (let
    (
      (property (unwrap! (map-get? properties { property-id: property-id }) (err ERR-NOT-FOUND)))
    )
    (asserts! (is-property-owner property-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-owner 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (is-eq (get status property) STATUS-VERIFIED) (err ERR-INVALID-STATUS))
    (map-set properties
      { property-id: property-id }
      (merge property { owner: new-owner })
    )
    (ok true)
  )
)

;; Update property details
(define-public (update-property-details (property-id uint) (address (string-utf8 256)) (description (string-utf8 512)))
  (let
    (
      (property (unwrap! (map-get? properties { property-id: property-id }) (err ERR-NOT-FOUND)))
    )
    (asserts! (is-property-owner property-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status property) STATUS-VERIFIED) (err ERR-INVALID-STATUS))
    (map-set properties
      { property-id: property-id }
      (merge property { address: address, description: description, status: STATUS-PENDING, verified-at: none })
    )
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-property (property-id uint))
  (ok (unwrap! (map-get? properties { property-id: property-id }) (err ERR-NOT-FOUND)))
)

(define-read-only (get-property-count (owner principal))
  (ok (default-to u0 (map-get? property-counter owner)))
)

(define-read-only (get-verification-fee)
  (ok (var-get verification-fee))
)

(define-read-only (get-admin)
  (ok (var-get admin))
)