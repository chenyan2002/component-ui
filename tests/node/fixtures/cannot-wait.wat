;; Calls an import where the guest can't wait for its answer: in its start function, while the
;; component is instantiated, and in the destructor of `r`. Its WIT:
;;
;;   package test:cannot-wait;
;;   interface host {
;;     log: func(n: u32) -> u32;
;;   }
;;   interface api {
;;     resource r {
;;       constructor(n: u32);
;;     }
;;     started: func() -> u32;
;;   }
;;   world cannot-wait {
;;     import host;
;;     export api;
;;   }
(component
  (import "test:cannot-wait/host" (instance $host
    (export "log" (func (param "n" u32) (result u32)))
  ))
  (core func $log (canon lower (func $host "log")))

  ;; Logs 1 as it starts, keeping the answer for `started`, and an `r`'s number as it is dropped.
  (core module $main
    (import "host" "log" (func $log (param i32) (result i32)))
    (global $started (mut i32) (i32.const 0))
    (func $start (global.set $started (call $log (i32.const 1))))
    (start $start)
    (func (export "started") (result i32) (global.get $started))
    (func (export "dtor") (param i32) (drop (call $log (local.get 0))))
  )
  (core instance $main (instantiate $main
    (with "host" (instance (export "log" (func $log))))
  ))

  (type $r (resource (rep i32) (dtor (core func $main "dtor"))))
  (core func $resource.new (canon resource.new $r))
  ;; An `r`'s representation is its number.
  (core module $new
    (import "r" "new" (func $new (param i32) (result i32)))
    (func (export "new") (param i32) (result i32) (call $new (local.get 0)))
  )
  (core instance $new (instantiate $new
    (with "r" (instance (export "new" (func $resource.new))))
  ))

  (func $new (param "n" u32) (result (own $r)) (canon lift (core func $new "new")))
  (func $started (result u32) (canon lift (core func $main "started")))
  (component $api
    (import "r-type" (type $r (sub resource)))
    (import "new" (func $new (param "n" u32) (result (own $r))))
    (import "started" (func $started (result u32)))
    (export $r-export "r" (type $r))
    (export "[constructor]r" (func $new) (func (param "n" u32) (result (own $r-export))))
    (export "started" (func $started))
  )
  (instance $api (instantiate $api
    (with "r-type" (type $r))
    (with "new" (func $new))
    (with "started" (func $started))
  ))
  (export "test:cannot-wait/api" (instance $api))
)
