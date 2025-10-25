import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { promisify } from "util";
import { env } from "../validate-env";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Support two stored formats:
  // - scrypt: `${hexHash}.${salt}` (used by this app)
  // - bcrypt: `$2a$...` / `$2b$...` (used by legacy seed scripts)

  // If stored looks like a bcrypt hash, delegate to bcrypt.compare
  if (stored && stored.startsWith("$2")) {
    try {
      const ok = await bcrypt.compare(supplied, stored);
      return ok;
    } catch (err) {
      return false;
    }
  }

  const [hashed, salt] = stored.split(".");
  if (!salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }
    if (req.user.role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    next();
  };

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).send("Invalid username or password");
      }
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  app.post("/api/admin/users", requireAdmin, async (req, res, next) => {
    try {
      const { username, password, role } = req.body;

      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }

      if (username.length < 3 || username.length > 50) {
        return res.status(400).send("Username must be between 3 and 50 characters");
      }

      if (password.length < 6) {
        return res.status(400).send("Password must be at least 6 characters");
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const userRole = role === "admin" ? "admin" : "user";

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        role: userRole,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { username, role } = req.body;

      if (!username) {
        return res.status(400).send("Username is required");
      }

      if (username.length < 3 || username.length > 50) {
        return res.status(400).send("Username must be between 3 and 50 characters");
      }

      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).send("User not found");
      }

      const userWithSameUsername = await storage.getUserByUsername(username);
      if (userWithSameUsername && userWithSameUsername.id !== id) {
        return res.status(400).send("Username already exists");
      }

      const userRole = role === "admin" ? "admin" : "user";

      const updatedUser = await storage.updateUser(id, {
        username,
        role: userRole,
      });

      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;

      if (req.user?.id === id) {
        return res.status(400).send("Cannot delete your own account");
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).send("User not found");
      }

      await storage.deleteUser(id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  return { requireAdmin };
}
