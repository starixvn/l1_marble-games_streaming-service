import { appConfigs } from "../app-configs";
import jwt from "jsonwebtoken";

export class AuthenticateService {
  async generateJwtToken(payload: any) {
    return jwt.sign(payload, appConfigs.jwt.secret, { expiresIn: "2h" });
  }

  async getAuthenticatedToken(username: string, password: string) {
    const { username: jwtUsername, password: jwtPassword } = appConfigs.jwt;

    if (username !== jwtUsername || password !== jwtPassword) {
      throw new Error("Invalid username or password");
    }

    const payload = { name: username };
    return this.generateJwtToken(payload);
  }
}
