package  
{
	/**
	 * ...
	 * @author vadim
	 */
	public class Assets 
	{
		public static const GAMEWIDTH:int = 1408;
		public static const GAMEHEIGHT:int = 1088;
		public static var HEALTH:Number = 100;
		public static const WINCOINS:int = 15;
		public static var TOTALCOINS:int = 0;
		public static var LIFES: int = 3;
		
		public function Assets() 
		{
			
		}
		
		
		
		public static function UpdateCoins():void
		{
			TOTALCOINS += 1;
			trace(TOTALCOINS);
			if (TOTALCOINS == 15) trace("wictory");
		}
		
		public static function UpdateHealth(hp:Number)
		{
			HEALTH += hp;
			
			
			if (HEALTH < 0) 
			{
				HEALTH = 0;
				trace("game over");
			}
			
			if (HEALTH >= 100) HEALTH = 100
			
			
		}
		
		
	}

}